import { afterEach, describe, expect, it, vi } from 'vitest'
import { emailFrom, normalizeFromAddress } from '@/lib/email/from'
import { DEFAULT_FROM_EMAIL } from '@/lib/constants'

afterEach(() => vi.unstubAllEnvs())

describe('normalizeFromAddress', () => {
  it('uses the hardcoded verified sender in production regardless of FROM_EMAIL', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <noreply@info.alubonets.com>')
    expect(emailFrom()).toBe(DEFAULT_FROM_EMAIL)
  })
  it('keeps a valid verified sender', () => {
    expect(normalizeFromAddress('Alubonets <support@info.alubonets.com>', true)).toBe(DEFAULT_FROM_EMAIL)
  })
  it('wraps a bare verified address', () => {
    expect(normalizeFromAddress('support@info.alubonets.com', true)).toBe('Alubonets <support@info.alubonets.com>')
  })
  it('repairs a missing closing bracket so Resend accepts the from field', () => {
    expect(normalizeFromAddress('Alubonets <support@info.alubonets.com', true)).toBe(DEFAULT_FROM_EMAIL)
  })
  it('repairs a name and address with no brackets', () => {
    expect(normalizeFromAddress('Alubonets support@info.alubonets.com', true)).toBe(DEFAULT_FROM_EMAIL)
  })
  it('strips wrapping quotes from the env value', () => {
    expect(normalizeFromAddress('"Alubonets <support@info.alubonets.com>"', true)).toBe(DEFAULT_FROM_EMAIL)
  })
  it('uses the verified sender in production when FROM_EMAIL is on another domain', () => {
    expect(normalizeFromAddress('Alubonets <onboarding@resend.dev>', true)).toBe(DEFAULT_FROM_EMAIL)
    expect(normalizeFromAddress('Alubonets <noreply@alubonets.com>', true)).toBe(DEFAULT_FROM_EMAIL)
  })
  it('keeps the onboarding sender outside production', () => {
    expect(normalizeFromAddress('Alubonets <onboarding@resend.dev>', false)).toBe('Alubonets <onboarding@resend.dev>')
  })
  it('falls back when the value is empty or not an email', () => {
    expect(normalizeFromAddress('Alubonets', true)).toBe(DEFAULT_FROM_EMAIL)
    expect(normalizeFromAddress('  ', true)).toBe(DEFAULT_FROM_EMAIL)
    expect(normalizeFromAddress(undefined, true)).toBe(DEFAULT_FROM_EMAIL)
  })
})
