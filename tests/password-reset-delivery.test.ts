import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendReset: vi.fn(),
  recover: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock('@/lib/email/resend', () => ({ sendPasswordResetEmail: mocks.sendReset }))
vi.mock('@/lib/logger', () => ({ logError: mocks.logError, logInfo: mocks.logInfo }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: mocks.recover } }),
}))

import { deliverPasswordResetLink } from '@/lib/email/password-reset-delivery'

const input = {
  userId: 'member-1',
  fullName: 'Test Member',
  email: 'member@example.com',
  resetUrl: 'https://www.alubonets.com/reset-password?token=test-token',
  requestUrl: 'https://www.alubonets.com/api/auth/forgot-password',
}

describe('password reset delivery fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('NODE_ENV', 'production')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('keeps Resend when the branded email is accepted', async () => {
    mocks.sendReset.mockResolvedValue(undefined)
    await expect(deliverPasswordResetLink(input)).resolves.toEqual({ channel: 'resend' })
    expect(mocks.recover).not.toHaveBeenCalled()
  })

  it('falls back to Supabase recovery when Resend rejects the send', async () => {
    mocks.sendReset.mockRejectedValue(new Error('The info.alubonets.com domain is not verified'))
    mocks.recover.mockResolvedValue({ error: null })
    await expect(deliverPasswordResetLink(input)).resolves.toEqual({ channel: 'supabase' })
    expect(mocks.recover).toHaveBeenCalledWith(input.email, {
      redirectTo: 'https://www.alubonets.com/auth/callback?next=/reset-password',
    })
    expect(mocks.logInfo).toHaveBeenCalledWith('auth.password_reset.supabase_fallback', { userId: input.userId })
  })

  it('surfaces the original Resend failure when Supabase recovery also fails', async () => {
    mocks.sendReset.mockRejectedValue(new Error('Sender not verified'))
    mocks.recover.mockResolvedValue({ error: { message: 'Redirect URL not allowed' } })
    await expect(deliverPasswordResetLink(input)).rejects.toThrow('Sender not verified')
    expect(mocks.logError).toHaveBeenCalledWith(
      'auth.password_reset.supabase_fallback_failed',
      expect.any(Error),
      { userId: input.userId },
    )
  })
})
