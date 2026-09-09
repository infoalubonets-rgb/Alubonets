import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getSessionProfile } from '@/lib/auth/session'
import { createEmailChallenge, verifyEmailChallenge } from '@/lib/email-verification'
import { ROLE_HOME } from '@/lib/auth/types'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'
import { publicErrorMessage } from '@/lib/safe-error'

export async function POST(req: Request) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })
  const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400 })
  try {
    await enforceRateLimit(`verify-login-submit:${profile.id}`, 8, 15)
  } catch {
    return NextResponse.json({ error: 'Too many attempts. Please wait and try again.' }, { status: 429 })
  }
  const token = await verifyEmailChallenge(profile.id, parsed.data.code)
  if (!token) return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 400 })
  const store = await cookies()
  store.set('alubonets-verified', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return NextResponse.json({ redirectTo: ROLE_HOME[profile.role] })
}

export async function PUT() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })
  try {
    await enforceRateLimit(`verify-login-request:${profile.id}`, 5, 15)
  } catch {
    return NextResponse.json({ error: 'Too many codes requested. Please wait and try again.' }, { status: 429 })
  }
  try {
    const delivery = await createEmailChallenge(profile.id, profile.email)
    return NextResponse.json({
      ok: true,
      deliveredTo: delivery.to,
      redirected: delivery.redirected,
      accountEmail: profile.email,
    })
  } catch (cause) {
    logError('auth.verify_login.put_failed', cause, { userId: profile.id })
    return NextResponse.json(
      { error: publicErrorMessage(cause, 'Could not send the sign-in code. Check email settings on the server.') },
      { status: 503 },
    )
  }
}
