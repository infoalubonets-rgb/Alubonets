import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ user: vi.fn(), users: vi.fn(), update: vi.fn(), updateMany: vi.fn(), payments: vi.fn(), config: vi.fn(), settings: vi.fn(), audit: vi.fn(), notify: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: { user: { findUnique: m.user, findMany: m.users, update: m.update, updateMany: m.updateMany }, contribution: { findMany: m.payments } } }))
vi.mock('../lib/contribution-purpose-settings', () => ({ getPurposeRules: m.config }))
vi.mock('../lib/membership-standing-settings', () => ({ getStandingSettings: m.settings }))
vi.mock('../lib/audit', () => ({ writeAudit: m.audit }))
vi.mock('../lib/notifications', () => ({ notifyUsers: m.notify }))
import { recomputeMemberStanding } from '../lib/membership-standing-sync'
const member = { id: 'm', approvedAt: new Date('2025-01-01'), createdAt: new Date('2025-01-01'), principalMemberId: null, isPrincipal: false, standing: 'PAID_UP', standingReason: null, standingOverride: null, standingOverrideUntil: null, contributionExempt: false, contributionPlan: 'MONTHLY', memberProfile: null }
const rule = { categoryId: 'dues', amountKes: 100, frequency: 'MONTHLY', deadline: '2026-01-10', graceDays: 2, memberContribution: true, scope: 'ALL', memberIds: [] }
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-13T00:00:00Z'))
  m.user.mockResolvedValue(member); m.users.mockResolvedValue([]); m.payments.mockResolvedValue([])
  m.settings.mockResolvedValue({ monthlyFeeKes: 100, monthlyGraceDays: 15, annualFeeKes: 0, annualRenewalDays: 45, annualDueDate: null, effectiveFrom: new Date('2026-01-01') })
  m.config.mockResolvedValue({ rules: [rule], overrides: [] })
})
afterEach(() => vi.useRealTimers())
describe('applied purpose membership standing', () => {
  it('uses the configured deadline and amount after grace', async () => {
    expect((await recomputeMemberStanding('m')).lapsed).toBe(1)
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ standing: 'LAPSED', standingReason: 'Monthly contribution overdue: KES 100' }) }))
  })
  it('counts confirmed purpose payments against the requirement', async () => {
    m.payments.mockResolvedValue([{ userId: 'm', categoryId: 'dues', amount: 100, paidAt: new Date('2026-01-05'), transactionCategory: { billingKind: 'MONTHLY' } }])
    expect((await recomputeMemberStanding('m')).lapsed).toBe(0)
  })
  it('respects member-specific amount changes', async () => {
    m.config.mockResolvedValue({ rules: [rule], overrides: [{ userId: 'm', enabled: true, rule: { ...rule, amountKes: 50 } }] })
    await recomputeMemberStanding('m')
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ standingReason: 'Monthly contribution overdue: KES 50' }) }))
  })
  it('lets an individual exemption replace the default without falling back to legacy fees', async () => {
    m.config.mockResolvedValue({ rules: [rule], overrides: [{ userId: 'm', enabled: false, rule }] })
    expect((await recomputeMemberStanding('m')).lapsed).toBe(0)
  })
  it('keeps manual standing overrides and dependent exemptions', async () => {
    m.user.mockResolvedValue({ ...member, standingOverride: 'PAID_UP' })
    expect((await recomputeMemberStanding('m')).lapsed).toBe(0)
    m.user.mockResolvedValue({ ...member, contributionExempt: true })
    expect((await recomputeMemberStanding('m')).lapsed).toBe(0)
  })
  it('does not charge annual members a monthly plan', async () => {
    m.user.mockResolvedValue({ ...member, contributionPlan: 'ANNUAL' })
    expect((await recomputeMemberStanding('m')).lapsed).toBe(0)
  })
})
