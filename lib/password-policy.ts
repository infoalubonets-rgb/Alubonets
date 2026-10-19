import { z } from 'zod'

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be no more than 128 characters.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character.')

export function passwordError(password: string) {
  const result = passwordSchema.safeParse(password)
  return result.success ? null : result.error.issues[0]?.message || 'Password is not valid.'
}
