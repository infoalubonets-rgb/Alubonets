import { createHash, randomInt } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'alubonets-registration-email'
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || '')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export { COOKIE_NAME }

export async function createRegistrationEmailChallenge(email: string) {
  if (!process.env.JWT_SECRET) throw new Error('Email verification is not configured.')
  const code = String(randomInt(100000, 1000000))
  const token = await new SignJWT({ email, codeHash: hash(code), purpose: 'registration-email-code' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret())
  return { code, token }
}

export async function verifyRegistrationEmailCode(token: string | undefined, email: string, code: string) {
  if (!token || !process.env.JWT_SECRET) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.purpose !== 'registration-email-code' || payload.email !== email || payload.codeHash !== hash(code)) return null
    return new SignJWT({ email, purpose: 'registration-email-verified' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret())
  } catch {
    return null
  }
}

export async function registrationEmailIsVerified(token: string | undefined, email: string) {
  if (!token || !process.env.JWT_SECRET) return false
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.purpose === 'registration-email-verified' && payload.email === email
  } catch {
    return false
  }
}
