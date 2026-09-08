import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import { requestIp } from '@/lib/membership'
import {
  COOKIE_NAME,
  createRegistrationEmailChallenge,
  registrationEmailIsVerified,
  verifyRegistrationEmailCode,
} from '@/lib/registration-email-verification'
import { otpCodeHtml } from '@/lib/email/resend'

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.')

export async function GET(req: Request) {
  const email = emailSchema.safeParse(new URL(req.url).searchParams.get('email'))
  if (!email.success) return NextResponse.json({ verified: false })
  const store = await cookies()
  return NextResponse.json({ verified: await registrationEmailIsVerified(store.get(COOKIE_NAME)?.value, email.data) })
}

export async function POST(req: Request) {
  try {
    const email = emailSchema.parse((await req.json()).email)
    await enforceRateLimit(`register-email:${requestIp(req) || email}`, 5, 15)
    const existing = await prisma.user.findUnique({ where: { email }, select: { status: true, authUserId: true } })
    if (existing?.authUserId) return NextResponse.json({ error: 'This email already has an account. Please sign in.' }, { status: 409 })

    const { code, token } = await createRegistrationEmailChallenge(email)
    const key = process.env.RESEND_API_KEY
    if (!key || key.startsWith('re_your-')) throw new Error('Email verification is not configured.')
    const recipient = process.env.RESEND_TEST_EMAIL || email
    const { error } = await new Resend(key).emails.send({
      from: process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>',
      to: recipient,
      subject: 'Verify your Alubonets membership email',
      html: otpCodeHtml('Verify your membership application email', code),
    })
    if (error) throw new Error('Could not send the verification code.')
    const store = await cookies()
    store.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 })
    return NextResponse.json({ ok: true })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Could not send the verification code.' }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  const parsed = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.') }).safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const store = await cookies()
  const verified = await verifyRegistrationEmailCode(store.get(COOKIE_NAME)?.value, parsed.data.email, parsed.data.code)
  if (!verified) return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 400 })
  store.set(COOKIE_NAME, verified, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 86400 })
  return NextResponse.json({ ok: true })
}
