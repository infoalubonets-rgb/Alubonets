import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendReset: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendPasswordResetEmail: mocks.sendReset }))

import { deliverPasswordResetLink } from '@/lib/email/password-reset-delivery'

const input = {
  userId: 'member-1',
  fullName: 'Test Member',
  email: 'member@example.com',
  resetUrl: 'https://www.alubonets.com/reset-password?token=test-token',
  requestUrl: 'https://www.alubonets.com/api/auth/forgot-password',
}

describe('password reset delivery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sends the branded link through Resend', async () => {
    mocks.sendReset.mockResolvedValue(undefined)
    await expect(deliverPasswordResetLink(input)).resolves.toEqual({ channel: 'resend' })
    expect(mocks.sendReset).toHaveBeenCalledWith(input)
  })

  it('surfaces the Resend failure instead of sending another provider’s email', async () => {
    mocks.sendReset.mockRejectedValue(new Error('Sender not verified'))
    await expect(deliverPasswordResetLink(input)).rejects.toThrow('Sender not verified')
  })
})
