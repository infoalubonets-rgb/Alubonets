export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
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
import { verifyTotp } from '@/lib/mfa-totp'

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
  mfaToken: z.string().trim().min(6).max(8).optional(),
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
    try {
      await enforceRateLimit(ipRateKey, 20, 15)
      await enforceRateLimit(rateKey, 5, 15)
    } catch (cause) {
      logError('auth.login.rate_limit_failed', cause, { email, ipAddress })
      return NextResponse.json({ error: publicErrorMessage(cause, 'Too many attempts. Please wait and try again.') }, { status: 429 })
    }

    const precheck = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        lockedUntil: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    })
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
      const knownProfile = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      await recordFailedLogin(email, knownProfile?.id)
      await prisma.loginEvent.create({
        data: {
          userId: knownProfile?.id,
          email,
          success: false,
          reason: 'INVALID_CREDENTIALS',
          ipAddress,
          userAgent: req.headers.get('user-agent'),
        },
      })
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

    let profile = await prisma.user.findFirst({
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

    void clearRateLimit(rateKey).catch((cause) =>
      logError('auth.login.clear_rate_limit', cause, { email }),
    )
    void prisma.loginEvent
      .create({
        data: {
          userId: profile.id,
          email,
          success: true,
          ipAddress,
          userAgent: req.headers.get('user-agent'),
        },
      })
      .catch((cause) => logError('auth.login.event', cause, { email }))

    if (profile.status === 'PENDING') {
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

    if (profile.mfaEnabled && profile.mfaSecret) {
      if (!parsed.data.mfaToken) {
        await supabase.auth.signOut()
        return NextResponse.json({
          requiresMfa: true,
          error: 'Enter the authenticator code for this privileged account.',
        }, { status: 401 })
      }
      if (!verifyTotp(profile.mfaSecret, parsed.data.mfaToken)) {
        await supabase.auth.signOut()
        await recordFailedLogin(email, profile.id)
        return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 401 })
      }
    }

    if (profile.failedLoginCount > 0 || profile.lockedUntil) {
      await prisma.user.update({
        where: { id: profile.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastActiveAt: new Date() },
      })
    } else {
      await prisma.user.update({
        where: { id: profile.id },
        data: { lastActiveAt: new Date() },
      }).catch(() => undefined)
    }

    if (!(process.env.NODE_ENV !== 'production' && process.env.BYPASS_LOGIN_VERIFICATION === 'true')) {
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
