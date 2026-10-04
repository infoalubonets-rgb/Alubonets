import { describe, expect, it } from 'vitest'
import { computeActiveMonths, monthsOfYear, shiftMonth, type ActiveMonthPayment } from '../lib/active-months'

const monthly = (amount: number, period: string | null, paidAt = '2026-03-10'): ActiveMonthPayment => ({
  amount,
  billingKind: 'MONTHLY',
  period,
  paidAt: new Date(`${paidAt}T09:00:00.000Z`),
})

describe('active months', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(monthsOfYear(2026)).toHaveLength(12)
  })

  it('marks a fully paid month active and ignores a part payment', () => {
    const result = computeActiveMonths([monthly(500, '2026-01'), monthly(200, '2026-02')], 500)
    expect(result.activeMonths).toEqual(['2026-01'])
  })

  it('uses the payment month when no period is given', () => {
    const result = computeActiveMonths([monthly(500, null, '2026-04-02')], 500)
    expect(result.activeMonths).toEqual(['2026-04'])
  })

  it('carries an advance payment into following months', () => {
    const result = computeActiveMonths([monthly(1500, '2026-01')], 500)
    expect(result.activeMonths).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('tops up a part-paid month before moving on', () => {
    const result = computeActiveMonths([monthly(300, '2026-01'), monthly(700, '2026-01')], 500)
    expect(result.activeMonths).toEqual(['2026-01', '2026-02'])
  })

  it('treats any payment as active when no monthly fee is set', () => {
    const result = computeActiveMonths([monthly(50, '2026-05')], 0)
    expect(result.activeMonths).toEqual(['2026-05'])
  })

  it('covers 12 months for a full annual subscription', () => {
    const result = computeActiveMonths(
      [{ amount: 6000, billingKind: 'ANNUAL', period: null, paidAt: new Date('2026-02-15T00:00:00.000Z') }],
      0,
      6000,
    )
    expect(result.activeMonths[0]).toBe('2026-02')
    expect(result.activeMonths).toHaveLength(12)
    expect(result.activeMonths.at(-1)).toBe('2027-01')
  })
})
