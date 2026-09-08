import { describe, expect, it } from 'vitest'
import { registrationSchema } from '@/lib/membership'
import { createPasswordResetToken, hashPasswordResetToken, passwordError } from '@/lib/password-reset'

describe('password reset security', () => {
  it('creates opaque tokens and stores only a deterministic hash', () => {
    const first = createPasswordResetToken(); const second = createPasswordResetToken()
    expect(first.token).not.toBe(second.token)
    expect(first.tokenHash).toBe(hashPasswordResetToken(first.token))
    expect(first.tokenHash).not.toContain(first.token)
  })
  it.each(['Short1!', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoNumber!', 'NoSpecial1'])('rejects weak password %s', (password) => expect(passwordError(password)).toBeTruthy())
  it('accepts a complex password of at least eight characters', () => expect(passwordError('Strong1!')).toBeNull())
})

describe('fixed password policy for registration and reset', () => {
  it.each([
    ['Strong1!', true],
    ['Aa1!' + 'x'.repeat(124), true],
    ['Aa1!' + 'x'.repeat(125), false],
    ['Short1!', false],
    ['alllowercase1!', false],
    ['ALLUPPERCASE1!', false],
    ['NoNumber!', false],
    ['NoSpecial1', false],
  ])('validates %s consistently', (password, valid) => {
    expect(registrationSchema.shape.password.safeParse(password).success).toBe(valid)
    expect(passwordError(password) === null).toBe(valid)
  })
})