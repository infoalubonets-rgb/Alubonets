import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  members: vi.fn(),
  log: vi.fn(),
  send: vi.fn(),
  batch: vi.fn(),
}))

vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; batch = { send: mocks.batch } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findMany: mocks.members }, emailLog: { create: mocks.log } } }))
vi.mock('@/lib/pdf/receipt', () => ({ buildReceiptPdf: vi.fn() }))

import { sendBroadcastEmail, sendDirectEmails } from '@/lib/email/resend'

describe('system email logs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('RESEND_API_KEY', 're_test-key')
    vi.stubEnv('FROM_EMAIL', 'Alubonets <support@info.alubonets.com>')
    vi.stubEnv('RESEND_TEST_EMAIL', '')
    mocks.members.mockResolvedValue([{ id: 'member-1', email: 'member@example.com', fullName: 'Member' }])
    mocks.log.mockResolvedValue({})
    mocks.batch.mockResolvedValue({ error: null })
    mocks.send.mockResolvedValue({ error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('records a cron-style broadcast without an acting user', async () => {
    await sendBroadcastEmail({ subject: 'Event reminder', title: 'Dinner', body: 'Today', template: 'event_reminder', memberIds: ['member-1'] })
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    expect(mocks.log).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: null, status: 'sent', template: 'event_reminder' }) })
  })

  it('records a direct system email without an acting user', async () => {
    await sendDirectEmails({ emails: ['member@example.com'], subject: 'Notice', title: 'Notice', body: 'Hello', template: 'notice' })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.log).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: null, status: 'sent', template: 'notice' }) })
  })

  it('keeps the acting user when one is supplied', async () => {
    await sendBroadcastEmail({ subject: 'Notice', title: 'Notice', body: 'Hello', template: 'notice', actorId: 'admin-1', memberIds: ['member-1'] })
    expect(mocks.log).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'admin-1' }) })
  })
})
