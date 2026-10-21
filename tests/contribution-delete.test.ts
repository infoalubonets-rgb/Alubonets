import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireContributionRecorder: vi.fn(),
  contributionFindMany: vi.fn(),
  contributionUpdate: vi.fn(),
  transactionFindUnique: vi.fn(),
  transactionCreate: vi.fn(),
  transactionUpdate: vi.fn(),
  writeAudit: vi.fn(),
  recomputeStandingSafely: vi.fn(),
  refreshObligation: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ requireActiveRole: vi.fn(), requireAdmin: vi.fn(), requireTreasurer: vi.fn() }))
vi.mock('@/lib/auth/contribution-recorder', () => ({ requireContributionRecorder: mocks.requireContributionRecorder }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    financialTransaction: { create: mocks.transactionCreate, update: mocks.transactionUpdate, updateMany: vi.fn() },
    contribution: { update: mocks.contributionUpdate },
  }
  return {
    prisma: {
      contribution: { findMany: mocks.contributionFindMany },
      financialTransaction: { findUnique: mocks.transactionFindUnique },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})
vi.mock('@/lib/finance', () => ({
  compareMonths: vi.fn(), createLedgerContribution: vi.fn(), currentAccountingMonth: vi.fn(),
  getPeriodForDate: vi.fn().mockResolvedValue({ id: 'period', status: 'OPEN' }),
  manuallyOpenedPeriodId: vi.fn(),
  markEditedAfterClose: vi.fn(),
  monthsWithData: vi.fn(),
  periodFields: () => ({ periodId: 'period', addedAfterClose: false }),
  periodOpenBlocker: vi.fn(),
  recomputeStandingSafely: mocks.recomputeStandingSafely,
  refreshObligation: mocks.refreshObligation,
  runAfterResponse: vi.fn(), setManuallyOpenedPeriod: vi.fn(),
  transactionNumber: () => 'TX-NEW',
}))
vi.mock('@/lib/membership-standing-settings', () => ({ getStandingSettings: vi.fn(), saveStandingSettings: vi.fn() }))
vi.mock('@/lib/membership-standing-sync', () => ({ syncMembershipStanding: vi.fn() }))
vi.mock('@/lib/audit', () => ({ writeAudit: mocks.writeAudit }))
vi.mock('@/lib/data/queries', () => ({ TAGS: { contributions: 'contributions' } }))
vi.mock('@/lib/upload-signed', () => ({ createSignedUpload: vi.fn() }))
vi.mock('@/lib/feature-flags', () => ({ requireWelfareEnabled: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyUsers: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { deleteContributions } from '@/app/actions/finance'

const payment = (id: string, status: string, financialTransactionId: string | null, extra = {}) => ({
  id, status, financialTransactionId, userId: 'member', amount: 500, paidAt: new Date('2026-10-01'),
  category: 'Monthly', campaignId: null, projectId: null, user: { fullName: 'Jane Member' }, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireContributionRecorder.mockResolvedValue({ id: 'treasurer' })
})

describe('deleting contributions', () => {
  it('reverses a posted payment in the ledger and hides it', async () => {
    mocks.contributionFindMany.mockResolvedValue([payment('c1', 'CONFIRMED', 'tx1')])
    mocks.transactionFindUnique.mockResolvedValue({
      id: 'tx1', status: 'CONFIRMED', amount: 500, transactionNumber: 'TX-1', occurredAt: new Date('2026-10-01'),
      entries: [{ accountId: 'cash', debit: 500, credit: 0 }, { accountId: 'income', debit: 0, credit: 500 }],
    })
    const result = await deleteContributions({ ids: ['c1'], reason: 'Recorded twice' })
    expect(result).toEqual({ ok: true, deleted: 1, skipped: 0 })
    const reversal = mocks.transactionCreate.mock.calls[0][0].data
    expect(reversal.type).toBe('REVERSAL')
    expect(reversal.entries.create).toEqual([
      { accountId: 'cash', debit: 0, credit: 500, memo: 'Deleted: Recorded twice' },
      { accountId: 'income', debit: 500, credit: 0, memo: 'Deleted: Recorded twice' },
    ])
    expect(mocks.transactionUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tx1' }, data: expect.objectContaining({ status: 'REVERSED' }) }))
    expect(mocks.contributionUpdate).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'REVERSED', correctionReason: 'Deleted: Recorded twice' } })
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTRIBUTION_DELETE', entityId: 'c1', reason: 'Recorded twice' }))
    expect(mocks.recomputeStandingSafely).toHaveBeenCalledWith('member', 'treasurer')
  })

  it('bulk deletes, rejecting pending ledger entries and skipping already-deleted ids', async () => {
    mocks.contributionFindMany.mockResolvedValue([payment('c2', 'PENDING', 'tx2'), payment('c3', 'CONFIRMED', null)])
    mocks.transactionFindUnique.mockResolvedValue({ id: 'tx2', status: 'PENDING', entries: [] })
    const result = await deleteContributions({ ids: ['c2', 'c3', 'gone', 'c2'], reason: 'Test data' })
    expect(result).toEqual({ ok: true, deleted: 2, skipped: 1 })
    expect(mocks.transactionCreate).not.toHaveBeenCalled()
    expect(mocks.transactionUpdate).toHaveBeenCalledWith({ where: { id: 'tx2' }, data: { status: 'REJECTED', correctionReason: 'Deleted: Test data' } })
    expect(mocks.contributionUpdate).toHaveBeenCalledTimes(2)
    expect(mocks.writeAudit).toHaveBeenCalledTimes(2)
    expect(mocks.recomputeStandingSafely).toHaveBeenCalledTimes(1)
  })

  it('needs a reason and a selection', async () => {
    expect(await deleteContributions({ ids: ['c1'], reason: ' ' })).toMatchObject({ ok: false })
    expect(await deleteContributions({ ids: [], reason: 'Test data' })).toMatchObject({ ok: false })
    expect(mocks.contributionFindMany).not.toHaveBeenCalled()
  })

  it('refuses accounts that cannot record contributions', async () => {
    mocks.requireContributionRecorder.mockRejectedValue(new Error('Only Treasurer and Super Admin accounts can record contributions.'))
    expect(await deleteContributions({ ids: ['c1'], reason: 'Test data' })).toEqual({ ok: false, error: 'Only Treasurer and Super Admin accounts can record contributions.' })
    expect(mocks.contributionUpdate).not.toHaveBeenCalled()
  })
})
