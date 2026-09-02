import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'

export const PASSWORD_RESET_TTL_MINUTES = 10

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be no more than 128 characters.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character.')

export function createPasswordResetToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashPasswordResetToken(token) }
}

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function passwordError(password: string) {
  const result = passwordSchema.safeParse(password)
  return result.success ? null : result.error.issues[0]?.message || 'Password is not valid.'
}
