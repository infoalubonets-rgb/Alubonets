import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  pending: [] as Array<() => Promise<unknown>>,
  findUser: vi.fn(),
  findToken: vi.fn(),
  createToken: vi.fn(),
  deleteToken: vi.fn(),
  deliver: vi.fn(),
  supabase: vi.fn(),
  limit: vi.fn(),
  log: vi.fn(),
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<unknown>) => { m.pending.push(task) },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: m.findUser },
    passwordResetToken: { findFirst: m.findToken, create: m.createToken, delete: m.deleteToken },
  },
}))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: m.limit }))
vi.mock('@/lib/email/password-reset-delivery', () => ({ deliverPasswordResetLink: m.deliver, sendSupabaseRecoveryEmail: m.supabase }))
vi.mock('@/lib/logger', () => ({ logError: m.log }))
import { POST } from '@/app/api/auth/forgot-password/route'

const request = (email: string) =>
  new Request('https://www.alubonets.com/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
const runBackground = async () => { for (const task of m.pending.splice(0)) await task() }

describe('forgot password', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.pending.length = 0
    m.limit.mockResolvedValue(undefined)
    m.findToken.mockResolvedValue(null)
    m.createToken.mockResolvedValue({ id: 't1' })
    m.deleteToken.mockResolvedValue({})
    m.deliver.mockResolvedValue({ channel: 'resend' })
    m.supabase.mockResolvedValue(undefined)
  })

  it('answers the same way for an unknown email and sends nothing', async () => {
    m.findUser.mockResolvedValue(null)
    const res = await POST(request('nobody@example.com'))
    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('If an account exists')
    await runBackground()
    expect(m.deliver).not.toHaveBeenCalled()
    expect(m.supabase).not.toHaveBeenCalled()
  })

  it('replies before sending, then emails a real account', async () => {
    m.findUser.mockResolvedValue({ id: 'u1', email: 'member@example.com', fullName: 'Member', authUserId: 'auth-1' })
    const res = await POST(request('member@example.com'))
    expect(res.status).toBe(200)
    expect(m.deliver).not.toHaveBeenCalled()
    await runBackground()
    expect(m.deliver).toHaveBeenCalledWith(expect.objectContaining({ email: 'member@example.com', resetUrl: expect.stringContaining('/reset-password?token=') }))
  })

  it('never shows an error when sending fails; it discards the unsent link and logs, with no other provider', async () => {
    m.findUser.mockResolvedValue({ id: 'u1', email: 'member@example.com', fullName: 'Member', authUserId: 'auth-1' })
    m.deliver.mockRejectedValue(new Error('Resend rejected'))
    const res = await POST(request('member@example.com'))
    expect(res.status).toBe(200)
    await runBackground()
    expect(m.deleteToken).toHaveBeenCalled()
    expect(m.supabase).not.toHaveBeenCalled()
    expect(m.log).toHaveBeenCalledWith('auth.password_reset.request_failed', expect.any(Error), { userId: 'u1' })
  })

  it('still rejects an invalid email address', async () => {
    const res = await POST(request('not-an-email'))
    expect(res.status).toBe(400)
  })
})
