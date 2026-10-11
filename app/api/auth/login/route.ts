import { WORKSPACE_COOKIE } from '@/lib/auth/workspace'
export const dynamic = 'force-dynamic'

import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { ROLE_HOME } from '@/lib/auth/types'
import { syncUserMetadata } from '@/lib/auth/session'
import { toAuthUser } from '@/lib/auth/helpers'
import { clearRateLimit, enforceRateLimit } from '@/lib/rate-limit'
import { requestIp } from '@/lib/membership'
import { verificationStillValid } from '@/lib/email-verification'
import { logError } from '@/lib/logger'
import { publicErrorMessage } from '@/lib/safe-error'
import { getDisabledRoles, isLockedOutByRole, roleInactiveMessage } from '@/lib/disabled-roles'
import { EMAIL_VERIFICATION_ON } from '@/lib/auth/email-verification-switch'

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

async function recordFailedLogin(email: string, userId?: string) {
  if (!userId) return
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return
  const failedLoginCount = user.failedLoginCount + 1
  const lockedUntil =
    failedLoginCount >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : user.lockedUntil
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount, lockedUntil },
  })
}

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>

/** The JWT already carries app_metadata, so the Supabase admin round trip is only needed when it is stale. */
function metadataInSync(profile: Profile, current: Record<string, unknown> | undefined) {
  if (!current) return false
  const expected: Record<string, unknown> = {
    role: profile.role,
    status: profile.status,
    isSuperAdmin: profile.isSuperAdmin,
    dashboardAccess: profile.dashboardAccess,
    dbUserId: profile.id,
    fullName: profile.fullName,
    isPrincipal: profile.isPrincipal,
    principalMemberId: profile.principalMemberId,
  }
  return Object.entries(expected).every(([key, value]) => JSON.stringify(current[key] ?? null) === JSON.stringify(value ?? null))
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 })
    }
    const email = parsed.data.email
    const ipAddress = requestIp(req)
    // Broad per-IP throttle catches account-enumeration sweeps across many emails; the
    // per-account key below still protects a single account from a targeted brute force.
    const ipRateKey = `login-ip:${ipAddress || 'unknown'}`
    const rateKey = `login:${ipAddress || 'unknown'}:${email}`
    // The database is a long round trip away, so independent lookups run side by side.
    const [rateLimitError, precheck] = await Promise.all([
      Promise.all([enforceRateLimit(ipRateKey, 20, 15), enforceRateLimit(rateKey, 5, 15)]).then(
        () => null,
        (cause: unknown) => cause ?? new Error('rate limit'),
      ),
      prisma.user.findUnique({ where: { email } }),
    ])
    if (rateLimitError) {
      logError('auth.login.rate_limit_failed', rateLimitError, { email, ipAddress })
      return NextResponse.json({ error: publicErrorMessage(rateLimitError, 'Too many attempts. Please wait and try again.') }, { status: 429 })
    }

    if (precheck?.lockedUntil && precheck.lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error:
            'This account is temporarily locked after too many failed sign-in attempts. Try again later or contact an administrator.',
        },
        { status: 423 },
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error || !data.user) {
      const message = error?.message?.toLowerCase() ?? ''
      if (message.includes('email not confirmed')) {
        return NextResponse.json(
          {
            error:
              'Your email address has not been verified yet. Please check your inbox for the verification link.',
          },
          { status: 401 }
        )
      }
      const knownProfile = precheck
      await Promise.all([
        recordFailedLogin(email, knownProfile?.id),
        prisma.loginEvent.create({
          data: {
            userId: knownProfile?.id,
            email,
            success: false,
            reason: 'INVALID_CREDENTIALS',
            ipAddress,
            userAgent: req.headers.get('user-agent'),
          },
        }),
      ])
      if (!knownProfile) {
        return NextResponse.json(
          {
            error:
              'We could not find an account with this email address. Please check the spelling or create an account first.',
          },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      )
    }

    let profile =
      precheck && (precheck.authUserId === data.user.id || !precheck.authUserId)
        ? precheck
        : await prisma.user.findFirst({
            where: {
              OR: [{ authUserId: data.user.id }, { email: parsed.data.email }],
            },
          })

    if (!profile) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'No member profile found. Please register first.' },
        { status: 403 }
      )
    }

    if (!profile.authUserId) {
      profile = await prisma.user.update({
        where: { id: profile.id },
        data: { authUserId: data.user.id },
      })
    }

    // Don't block sign-in on a slow Supabase metadata sync
    if (!metadataInSync(profile, data.user.app_metadata)) {
      try {
        await Promise.race([
          syncUserMetadata(profile),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('metadata sync timeout')), 6_000),
          ),
        ])
      } catch (cause) {
        logError('auth.login.metadata_sync', cause, { userId: profile.id })
      }
    }

    after(() =>
      clearRateLimit(rateKey).catch((cause) => logError('auth.login.clear_rate_limit', cause, { email })),
    )
    const signedInUserId = profile.id
    const userAgent = req.headers.get('user-agent')
    // Bookkeeping writes run after the response is sent so they don't hold up sign-in.
    const recordSuccessfulLogin = () =>
      after(() =>
        prisma.loginEvent
          .create({
            data: {
              userId: signedInUserId,
              email,
              success: true,
              ipAddress,
              userAgent,
            },
          })
          .catch((cause) => logError('auth.login.event', cause, { email })),
      )

    const loginCookieStore = await cookies()
    loginCookieStore.delete(WORKSPACE_COOKIE)

    if (profile.status === 'PENDING') {
      recordSuccessfulLogin()
      return NextResponse.json({
        user: toAuthUser(profile),
        redirectTo: '/pending',
        status: 'PENDING',
      })
    }

    if (profile.status === 'SUSPENDED') {
      await supabase.auth.signOut()
      return NextResponse.json(
        {
          error:
            'Your account has been temporarily suspended. Please contact the group administrator.',
        },
        { status: 403 }
      )
    }

    if (profile.status !== 'ACTIVE') {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Your account is not active. Please contact the group administrator.' },
        { status: 403 }
      )
    }

    if (isLockedOutByRole(profile, await getDisabledRoles())) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: roleInactiveMessage(profile.role), code: 'ROLE_INACTIVE' },
        { status: 403 }
      )
    }

    recordSuccessfulLogin()

    const clearLockout = profile.failedLoginCount > 0 || Boolean(profile.lockedUntil)
    after(() =>
      prisma.user
        .update({
          where: { id: signedInUserId },
          data: clearLockout
            ? { failedLoginCount: 0, lockedUntil: null, lastActiveAt: new Date() }
            : { lastActiveAt: new Date() },
        })
        .catch((cause) => logError('auth.login.last_active', cause, { email })),
    )

    // Sign-in email codes are switched off until the sending domain is verified (see the switch).
    if (EMAIL_VERIFICATION_ON && !(process.env.NODE_ENV !== 'production' && process.env.BYPASS_LOGIN_VERIFICATION === 'true')) {
      const cookieStoreForVerification = await cookies()
      const verificationHours = 24
      const verified = await verificationStillValid(
        cookieStoreForVerification.get('alubonets-verified')?.value,
        profile.id,
        verificationHours,
      )
      if (!verified) {
        return NextResponse.json({
          user: toAuthUser(profile),
          redirectTo: '/verify-login',
          status: profile.status,
          requiresVerification: true,
        })
      }
    }

    const user = toAuthUser(profile)
    return NextResponse.json({
      user: {
        ...user,
        isSuperAdmin: profile.isSuperAdmin,
        dashboardAccess: profile.dashboardAccess,
      },
      redirectTo: ROLE_HOME[user.role],
      status: profile.status,
    })
  } catch (err) {
    logError('auth.login.failed', err, { path: '/api/auth/login' })
    return NextResponse.json({ error: publicErrorMessage(err, 'We could not sign you in right now. Please try again shortly.') }, { status: 503 })
  }
}
