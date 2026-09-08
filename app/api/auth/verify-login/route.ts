import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getSessionProfile } from '@/lib/auth/session'
import { verifyEmailChallenge } from '@/lib/email-verification'
import { createEmailChallenge } from '@/lib/email-verification'
import { ROLE_HOME } from '@/lib/auth/types'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Session expired.' }, { status: 401 })
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
  if (!profile) return NextResponse.json({ error: 'Session expired.' }, { status: 401 })
  try {
    await enforceRateLimit(`verify-login-request:${profile.id}`, 5, 15)
  } catch {
    return NextResponse.json({ error: 'Too many codes requested. Please wait and try again.' }, { status: 429 })
  }
  await createEmailChallenge(profile.id, profile.email)
  return NextResponse.json({ ok: true })
}
