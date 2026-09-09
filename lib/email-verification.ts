import { createHash, randomInt } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { CONTACT_EMAIL } from '@/lib/constants'
import { otpCodeHtml } from '@/lib/email/resend'
import { logError } from '@/lib/logger'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || '')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function fromAddress() {
  return process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>'
}

/**
 * Resend's onboarding sender can only deliver to the verified Resend account inbox.
 * Until a custom domain is verified, login codes go to RESEND_TEST_EMAIL or info@.
 */
export function resolveOtpRecipient(intendedEmail: string) {
  const override = process.env.RESEND_TEST_EMAIL?.trim()
  if (override) return { to: override, redirected: override.toLowerCase() !== intendedEmail.toLowerCase() }
  if (fromAddress().includes('onboarding@resend.dev')) {
    return { to: CONTACT_EMAIL, redirected: intendedEmail.toLowerCase() !== CONTACT_EMAIL.toLowerCase() }
  }
  return { to: intendedEmail, redirected: false }
}

export async function verificationStillValid(token: string | undefined, userId: string, hours: number) {
  if (!token || !process.env.JWT_SECRET) return false
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.sub === userId && typeof payload.verifiedAt === 'number' && Date.now() - payload.verifiedAt < hours * 3600000
  } catch {
    return false
  }
}

export async function createEmailChallenge(userId: string, email: string) {
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET is not configured on the server, so login codes cannot be issued.')
  }
  const code = String(randomInt(100000, 1000000))
  await prisma.emailVerificationChallenge.create({
    data: { userId, codeHash: hash(code), expiresAt: new Date(Date.now() + 10 * 60000) },
  })
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('re_your-')) {
    throw new Error('RESEND_API_KEY is not configured on the server, so the login code cannot be emailed.')
  }
  const { to, redirected } = resolveOtpRecipient(email)
  const intro = redirected
    ? `Sign-in code for <strong>${email}</strong> (delivered to the group test inbox)`
    : 'Your sign-in verification code'
  const { data, error } = await new Resend(key).emails.send({
    from: fromAddress(),
    to,
    subject: 'Your Alubonets sign-in code',
    html: otpCodeHtml(intro, code),
  })
  if (error) {
    logError('auth.verify_login.send_failed', error, { userId, to, intended: email })
    throw new Error(error.message || 'Could not send verification code.')
  }
  await prisma.emailLog.create({
    data: {
      userId,
      toEmail: to,
      subject: 'Your Alubonets sign-in code',
      template: 'login_otp',
      status: 'accepted',
      meta: { providerMessageId: data?.id || null, intendedRecipient: email, redirected },
    },
  }).catch(() => undefined)
  return { to, redirected }
}

export async function verifyEmailChallenge(userId: string, code: string) {
  if (!process.env.JWT_SECRET?.trim()) return null
  const challenge = await prisma.emailVerificationChallenge.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge || challenge.attempts >= 5 || hash(code) !== challenge.codeHash) {
    if (challenge) {
      await prisma.emailVerificationChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      })
    }
    return null
  }
  await prisma.emailVerificationChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  })
  return new SignJWT({ verifiedAt: Date.now() })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret())
}
