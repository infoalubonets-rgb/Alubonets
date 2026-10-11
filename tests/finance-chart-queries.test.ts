import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ contribution: { findMany: vi.fn(), groupBy: vi.fn() }, user: { findMany: vi.fn() } }))
vi.mock('../lib/prisma', () => ({ prisma: db }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }))
import { getContributionChartSeriesFresh, getContributionAnalyticsFresh } from '../lib/data/queries'

describe('database-backed finance charts', () => {
  beforeEach(() => vi.clearAllMocks())
  it('sums actual payments by Nairobi month, including boundary payments', async () => {
    db.contribution.findMany.mockResolvedValue([
      { amount: 100, paidAt: new Date('2026-09-30T20:59:00Z') },
      { amount: 200, paidAt: new Date('2026-09-30T21:01:00Z') },
      { amount: 350, paidAt: new Date('2026-10-10T12:00:00Z') },
    ])
    expect(await getContributionChartSeriesFresh()).toEqual({ labels: ['Sep 2026', 'Oct 2026'], values: [100, 550] })
    expect(db.contribution.findMany.mock.calls[0][0].where.status.in).toEqual(['CONFIRMED', 'RECONCILED'])
    await getContributionChartSeriesFresh()
    expect(db.contribution.findMany).toHaveBeenCalledTimes(2)
  })
  it('uses database amounts and full record counts for methods and contributors', async () => {
    db.contribution.groupBy.mockResolvedValueOnce([{ paymentMethod: 'MPESA', _sum: { amount: 1234 }, _count: 150 }])
      .mockResolvedValueOnce([{ userId: 'member-1', _sum: { amount: 1234 } }])
    db.user.findMany.mockResolvedValue([{ id: 'member-1', fullName: 'Test Member' }])
    expect(await getContributionAnalyticsFresh()).toEqual({ contributorCount: 1, byMethod: [{ method: 'MPESA', label: 'M-Pesa', total: 1234, count: 150 }], topContributors: [{ name: 'Test Member', total: 1234 }] })
    for (const [query] of db.contribution.groupBy.mock.calls) expect(query.where.status.in).toEqual(['CONFIRMED', 'RECONCILED'])
  })
})
