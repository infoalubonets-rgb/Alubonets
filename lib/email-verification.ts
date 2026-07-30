import { createHash, randomInt } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || '')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export async function verificationStillValid(token: string | undefined, userId: string, hours: number) {
  if (!token || !process.env.JWT_SECRET) return false
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.sub === userId && typeof payload.verifiedAt === 'number' && Date.now() - payload.verifiedAt < hours * 3600000
  } catch { return false }
}

export async function createEmailChallenge(userId: string, email: string) {
  const code = String(randomInt(100000, 1000000))
  await prisma.emailVerificationChallenge.create({ data: { userId, codeHash: hash(code), expiresAt: new Date(Date.now() + 10 * 60000) } })
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('re_your-')) throw new Error('Email verification is not configured.')
  const recipient = process.env.RESEND_TEST_EMAIL || email
  const { error } = await new Resend(key).emails.send({ from: process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>', to: recipient, subject: 'Your Alubonets verification code', html: `<p>Your Alubonets verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes.</p>` })
  if (error) throw new Error('Could not send verification code.')
}

export async function verifyEmailChallenge(userId: string, code: string) {
  const challenge = await prisma.emailVerificationChallenge.findFirst({ where: { userId, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
  if (!challenge || challenge.attempts >= 5 || hash(code) !== challenge.codeHash) {
    if (challenge) await prisma.emailVerificationChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } })
    return null
  }
  await prisma.emailVerificationChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } })
  return new SignJWT({ verifiedAt: Date.now() }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('24h').sign(secret())
}
