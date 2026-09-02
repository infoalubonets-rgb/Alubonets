import { describe, expect, it } from 'vitest'
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
