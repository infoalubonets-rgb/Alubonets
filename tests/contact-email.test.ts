import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ send: vi.fn(), findSetting: vi.fn(), upsert: vi.fn(), assignee: vi.fn(), users: vi.fn(), create: vi.fn(), update: vi.fn(), notify: vi.fn(), contact: vi.fn(), log: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: m.send } } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/prisma', () => {
  const prisma = { appSetting: { findUnique: m.findSetting, upsert: m.upsert }, user: { findFirst: m.assignee, findMany: m.users }, contactSubmission: { create: m.create, update: m.update }, userNotification: { create: m.notify }, $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma) }
  return { prisma }
})
vi.mock('@/lib/auth/session', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('@/lib/settings', () => ({ getPublicContact: m.contact }))
vi.mock('@/lib/logger', () => ({ logError: m.log }))
vi.mock('@/lib/pdf/receipt', () => ({ buildReceiptPdf: vi.fn() }))
import { sendContactMessage } from '@/app/actions/contact'
import { DEFAULT_FROM_EMAIL } from '@/lib/constants'
function form() {
  const data = new FormData()
  for (const [key, value] of Object.entries({ name: 'Visitor', email: 'visitor@example.com', message: 'Please tell me about joining.', category: 'Membership' })) data.set(key, value)
  return data
}
describe('contact enquiry forwarding and notifications', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', 're_test-key')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <onboarding@resend.dev>')
    vi.stubEnv('RESEND_TEST_EMAIL', 'old-test@example.com')
    m.findSetting.mockResolvedValue({ value: 'infoalubonets@gmail.com' })
    m.assignee.mockResolvedValue({ id: 'admin-1' })
    m.users.mockResolvedValue([])
    m.create.mockResolvedValue({ id: 'enquiry-1' })
    m.update.mockResolvedValue({})
    m.notify.mockResolvedValue({})
    m.contact.mockResolvedValue({ enquiryEmail: 'stale@example.com', recipients: [] })
    m.send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })
  afterEach(() => vi.unstubAllEnvs())
  it('saves the enquiry and notification and emails the current configured inbox without test recipients', async () => {
    expect(await sendContactMessage(form())).toEqual({ ok: true })
    expect(m.send).toHaveBeenCalledTimes(1)
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ from: DEFAULT_FROM_EMAIL, to: ['infoalubonets@gmail.com'], replyTo: 'visitor@example.com', html: expect.stringContaining('Please tell me about joining.') }))
    expect(m.notify).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'admin-1', entityId: 'enquiry-1', type: 'contact_enquiry', audienceRoles: ['ADMIN'] }) })
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'enquiry-1' }, data: { emailStatus: 'sent' } })
  })
  it('isolates rejected and throwing copy recipients from the primary delivery', async () => {
    m.contact.mockResolvedValue({ recipients: ['bad@example.com', 'other@example.com', 'INFOALUBONETS@gmail.com'] })
    m.send.mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error('Copy failed')).mockResolvedValueOnce({ error: null })
    expect(await sendContactMessage(form())).toEqual({ ok: true })
    expect(m.send).toHaveBeenCalledTimes(3)
    expect(m.send).toHaveBeenNthCalledWith(3, expect.objectContaining({ to: 'other@example.com' }))
    expect(m.update).toHaveBeenCalledTimes(1)
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'enquiry-1' }, data: { emailStatus: 'sent' } })
  })
  it('retains the enquiry and system notification when primary email is rejected', async () => {
    m.send.mockResolvedValue({ error: { message: 'Sender not verified' } })
    expect(await sendContactMessage(form())).toEqual({ ok: true })
    expect(m.create).toHaveBeenCalledTimes(1)
    expect(m.notify).toHaveBeenCalledTimes(1)
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'enquiry-1' }, data: { emailStatus: 'failed' } })
    expect(m.log).toHaveBeenCalledWith('contact.email.rejected', expect.anything(), { submissionId: 'enquiry-1' })
  })
  it('retains enquiries and notifications when email is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await sendContactMessage(form())
    expect(m.send).not.toHaveBeenCalled()
    expect(m.notify).toHaveBeenCalledTimes(1)
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'enquiry-1' }, data: { emailStatus: 'not_configured' } })
  })
  it('accepts the short message from the reported form submission', async () => {
    const data = form()
    data.set('name', 'Info Alubonets')
    data.set('email', 'infoalubonets@gmail.com')
    data.set('phone', '+254714516132')
    data.set('message', 'hehe')
    expect(await sendContactMessage(data)).toEqual({ ok: true })
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ message: 'hehe' }) })
  })
  it('explains a whitespace-only message and does not save or email it', async () => {
    const data = form()
    data.set('message', '   ')
    expect(await sendContactMessage(data)).toEqual({ ok: false, error: 'invalid', message: 'Enter a message.' })
    expect(m.create).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })
  it('identifies an invalid email instead of blaming every input', async () => {
    const data = form()
    data.set('email', 'invalid-email')
    expect(await sendContactMessage(data)).toEqual({ ok: false, error: 'invalid', message: 'Enter a valid email address.' })
  })

})
