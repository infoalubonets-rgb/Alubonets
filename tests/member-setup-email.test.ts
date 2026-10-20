import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ send: vi.fn(), log: vi.fn(), override: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: m.send } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { emailLog: { create: m.log } } }))
vi.mock('@/lib/email/resend', () => ({
  baseHtml: (body: string) => `<html>${body}</html>`,
  emailFrom: () => 'Alubonets <support@info.alubonets.com>',
  testEmailOverride: m.override,
}))
import { sendMemberSetupEmail } from '@/lib/email/member-setup'

const input = {
  userId: 'u1',
  actorId: 'admin',
  to: 'new.member@example.com',
  fullName: 'Peter Wekesa',
  roleLabel: 'Member',
  setupUrl: 'https://www.alubonets.com/account-setup?token=abc',
  temporaryPassword: '@U37HpqTBgUe',
}

describe('new member setup email', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('RESEND_API_KEY', 're_live-key')
    m.override.mockReturnValue(null)
    m.log.mockResolvedValue({})
    m.send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('sends the setup link, sign-in email and temporary password to the member', async () => {
    expect(await sendMemberSetupEmail(input)).toEqual({ sent: true, deliveredTo: 'new.member@example.com', redirectedToTestInbox: false })
    const mail = m.send.mock.calls[0][0]
    expect(mail.to).toBe('new.member@example.com')
    expect(mail.html).toContain('account-setup?token=abc')
    expect(mail.html).toContain('@U37HpqTBgUe')
    expect(mail.html).toContain('Hello Peter')
  })
  it('reports the provider’s reason instead of claiming success', async () => {
    m.send.mockResolvedValue({ data: null, error: { message: 'Domain not verified' } })
    expect(await sendMemberSetupEmail(input)).toEqual({ sent: false, error: expect.stringContaining('Domain not verified') })
    expect(m.log).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'failed' }) })
  })
  it('never throws when the provider is unreachable', async () => {
    m.send.mockRejectedValue(new Error('fetch failed'))
    expect(await sendMemberSetupEmail(input)).toEqual({ sent: false, error: expect.stringContaining('fetch failed') })
  })
  it('says when test mode sent it to the test inbox instead of the member', async () => {
    m.override.mockReturnValue('infoalubonets@gmail.com')
    expect(await sendMemberSetupEmail(input)).toEqual({ sent: true, deliveredTo: 'infoalubonets@gmail.com', redirectedToTestInbox: true })
  })
  it('escapes member-typed values in the email', async () => {
    await sendMemberSetupEmail({ ...input, fullName: '<b>Evil</b> Name' })
    expect(m.send.mock.calls[0][0].html).toContain('&lt;b&gt;Evil&lt;/b&gt;')
  })
})
