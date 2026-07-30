import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getSessionProfile } from '@/lib/auth/session'
import { verifyEmailChallenge } from '@/lib/email-verification'
import { createEmailChallenge } from '@/lib/email-verification'
import { ROLE_HOME } from '@/lib/auth/types'
export async function POST(req: Request) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Session expired.' }, { status: 401 })
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400 })
  const token = await verifyEmailChallenge(profile.id, parsed.data.code)
  if (!token) return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 400 })
  const store = await cookies()
  store.set('alubonets-verified', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 })
  return NextResponse.json({ redirectTo: ROLE_HOME[profile.role] })
}
export async function PUT() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Session expired.' }, { status: 401 })
  await createEmailChallenge(profile.id, profile.email)
  return NextResponse.json({ ok: true })
}
