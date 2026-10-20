import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ send: vi.fn(), log: vi.fn(), logError: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { emailLog: { create: mocks.log } } }))
vi.mock('@/lib/pdf/receipt', () => ({ buildReceiptPdf: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logError: mocks.logError }))
import { sendPasswordResetEmail } from '@/lib/email/resend'
import { DEFAULT_FROM_EMAIL } from '@/lib/constants'

const input = { userId: 'member-1', fullName: 'Test Member', email: 'member@example.com', resetUrl: 'https://alubonets.com/reset-password?token=test-token' }
describe('password reset email delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('RESEND_API_KEY', 're_test-key')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <onboarding@resend.dev>')
    vi.stubEnv('RESEND_TEST_EMAIL', 'test-inbox@example.com')
    mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
    mocks.log.mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllEnvs())
  it('delivers production recovery links to the account owner using the real sender despite stale test settings', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await sendPasswordResetEmail(input)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ from: DEFAULT_FROM_EMAIL, to: input.email, html: expect.stringContaining(input.resetUrl) }))
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ meta: expect.objectContaining({ testMode: false }) }) }))
  })
  it('retains an explicitly configured production sender', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <support@info.alubonets.com>')
    await sendPasswordResetEmail(input)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ from: 'Alubonets <support@info.alubonets.com>', to: input.email }))
  })
  it('keeps test redirection available outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await sendPasswordResetEmail(input)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'test-inbox@example.com' }))
  })
  it('preserves an accepted recovery email when logging fails', async () => {
    mocks.log.mockRejectedValue(new Error('Database unavailable'))
    await expect(sendPasswordResetEmail(input)).resolves.toBeUndefined()
    expect(mocks.logError).toHaveBeenCalledWith('auth.password_reset.email_log_failed', expect.any(Error), { userId: input.userId })
  })
  it('reports provider rejection, keeping the reason in the email log, so the unsent token is discarded', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: 'Sender not verified' } })
    await expect(sendPasswordResetEmail(input)).rejects.toThrow('Sender not verified')
    expect(mocks.log).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'failed', meta: expect.objectContaining({ error: 'Sender not verified' }) }) })
  })
  it('never sends live mail from an unverified domain in FROM_EMAIL', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <noreply@alubonets.com>')
    await sendPasswordResetEmail(input)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ from: DEFAULT_FROM_EMAIL, to: input.email }))
  })
  it('retries from the verified sender when a configured sender is refused', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <noreply@info.alubonets.com>')
    mocks.send
      .mockResolvedValueOnce({ data: null, error: { message: 'Invalid `from` field' } })
      .mockResolvedValueOnce({ data: { id: 'email-2' }, error: null })
    await sendPasswordResetEmail(input)
    expect(mocks.send).toHaveBeenNthCalledWith(1, expect.objectContaining({ from: 'Alubonets <noreply@info.alubonets.com>' }))
    expect(mocks.send).toHaveBeenNthCalledWith(2, expect.objectContaining({ from: DEFAULT_FROM_EMAIL, to: input.email }))
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'accepted', meta: expect.objectContaining({ from: DEFAULT_FROM_EMAIL }) }) }))
  })
})
