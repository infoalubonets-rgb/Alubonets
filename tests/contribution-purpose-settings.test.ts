import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ auth: vi.fn(), category: vi.fn(), member: vi.fn(), count: vi.fn(), previous: vi.fn(), upsert: vi.fn(), categoryUpdate: vi.fn(), memberUpdate: vi.fn(), membersUpdate: vi.fn(), audit: vi.fn(), sync: vi.fn(), recompute: vi.fn(), config: vi.fn() }))
vi.mock('../lib/auth/session', () => ({ requireActiveRole: m.auth }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('../lib/audit', () => ({ writeAudit: m.audit }))
vi.mock('../lib/payment-categories', () => ({ isSystemCategoryCode: (code: string) => code === 'OTHER' }))
vi.mock('../lib/membership-standing-sync', () => ({ syncMembershipStanding: m.sync, recomputeMemberStanding: m.recompute }))
vi.mock('../lib/contribution-purpose-settings', () => ({ getPurposeRules: m.config }))
vi.mock('../lib/prisma', () => ({ prisma: { transactionCategory: { findUniqueOrThrow: m.category }, user: { findUniqueOrThrow: m.member, count: m.count }, appSetting: { findUnique: m.previous }, $transaction: (fn: (tx: unknown) => unknown) => fn({ appSetting: { upsert: m.upsert }, transactionCategory: { update: m.categoryUpdate }, user: { update: m.memberUpdate, updateMany: m.membersUpdate } }) } }))
import { savePurposeRule } from '../app/actions/contribution-purpose-settings'
const rule = { categoryId: 'monthly', amountKes: 400, frequency: 'MONTHLY', deadline: '2026-10-20', graceDays: 5, memberContribution: true, scope: 'ALL', memberIds: [] }
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ id: 'treasurer' }); m.category.mockResolvedValue({ id: 'monthly', active: true, code: 'MONTHLY_DUES' }); m.previous.mockResolvedValue(null); m.config.mockResolvedValue({ rules: [], overrides: [] }); m.member.mockResolvedValue({ id: 'member' }); m.count.mockResolvedValue(1) })
describe('purpose settings application', () => {
  it('persists the schedule and amount and recalculates standing without creating payments', async () => {
    await savePurposeRule(rule)
    expect(m.auth).toHaveBeenCalledWith(['ADMIN', 'TREASURER'])
    expect(m.categoryUpdate).toHaveBeenCalledWith({ where: { id: 'monthly' }, data: { fixedAmountKes: 400, billingKind: 'MONTHLY' } })
    const saved = m.upsert.mock.calls.find(([args]) => args.where.key === 'finance_purpose:rule:monthly')?.[0]
    expect(JSON.parse(saved.create.value)).toEqual(rule)
    expect(m.sync).toHaveBeenCalledOnce()
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTRIBUTION_PURPOSE_SETTINGS_UPDATE', userId: 'treasurer' }))
  })
  it('isolates member changes from purpose defaults and updates the member plan', async () => {
    await savePurposeRule(rule, 'member', true)
    expect(m.categoryUpdate).not.toHaveBeenCalled()
    expect(m.memberUpdate).toHaveBeenCalledWith({ where: { id: 'member' }, data: { contributionPlan: 'MONTHLY' } })
    expect(m.recompute).toHaveBeenCalledWith('member', 'treasurer')
    expect(m.sync).not.toHaveBeenCalled()
  })
  it('rejects unauthorised changes before writing settings', async () => {
    m.auth.mockRejectedValue(new Error('Not allowed'))
    await expect(savePurposeRule(rule)).rejects.toThrow('Not allowed')
    expect(m.upsert).not.toHaveBeenCalled()
  })
  it('protects system purposes', async () => {
    m.category.mockResolvedValue({ active: true, code: 'OTHER' })
    await expect(savePurposeRule(rule)).rejects.toThrow('cannot be configured')
    expect(m.upsert).not.toHaveBeenCalled()
  })
  it('prevents accidental double monthly membership requirements', async () => {
    m.config.mockResolvedValue({ rules: [{ ...rule, categoryId: 'existing' }], overrides: [] })
    await expect(savePurposeRule(rule)).rejects.toThrow('already applied')
    expect(m.upsert).not.toHaveBeenCalled()
  })
})
