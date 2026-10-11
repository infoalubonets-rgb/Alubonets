import { describe, expect, it } from 'vitest'
import {
  annualExpiry,
  annualLastRenewalDay,
  isDependent,
  resolveFamilyStanding,
  upcomingAnnualRenewalDay,
  upcomingMonthlyDeadlines,
  computeStanding,
  hasPaidUpAccess,
  monthlyDeadline,
  overdueMonthCount,
  type StandingPayment,
  type StandingSettings,
} from '../lib/membership-standing'

const settings = (overrides: Partial<StandingSettings> = {}): StandingSettings => ({
  monthlyFeeKes: 500,
  monthlyGraceDays: 15,
  annualFeeKes: 0,
  annualRenewalDays: 45,
  annualDueDate: null,
  effectiveFrom: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
})

const member = { joinedAt: new Date('2025-01-01T00:00:00Z'), override: null, overrideUntil: null }
const monthly = (amount: number, paidAt: string): StandingPayment => ({ amount, billingKind: 'MONTHLY', paidAt: new Date(paidAt) })
const annual = (amount: number, paidAt: string): StandingPayment => ({ amount, billingKind: 'ANNUAL', paidAt: new Date(paidAt) })

describe('monthly deadlines', () => {
  it('gives month M until the grace day of month M+1', () => {
    expect(monthlyDeadline(new Date('2026-09-10T00:00:00Z'), 15).toISOString()).toBe('2026-10-16T00:00:00.000Z')
    expect(monthlyDeadline(new Date('2026-09-10T00:00:00Z'), 5).toISOString()).toBe('2026-10-06T00:00:00.000Z')
  })

  it('counts only months whose grace period has passed', () => {
    const first = new Date('2026-09-01T00:00:00Z')
    expect(overdueMonthCount(first, 15, new Date('2026-10-15T12:00:00Z'))).toBe(0)
    expect(overdueMonthCount(first, 15, new Date('2026-10-16T12:00:00Z'))).toBe(1)
    expect(overdueMonthCount(first, 15, new Date('2026-11-17T00:00:00Z'))).toBe(2)
  })
})

describe('computeStanding', () => {
  it('stays paid up inside the grace period', () => {
    const result = computeStanding([], member, settings(), new Date('2026-10-10T00:00:00Z'))
    expect(result.standing).toBe('PAID_UP')
  })

  it('lapses when a month is unpaid after the grace period', () => {
    const result = computeStanding([], member, settings(), new Date('2026-10-20T00:00:00Z'))
    expect(result.standing).toBe('LAPSED')
    expect(result.reason).toContain('September 2026')
    expect(result.monthlyArrearsKes).toBe(500)
  })

  it('respects a custom grace period set by the Admin', () => {
    const now = new Date('2026-10-20T00:00:00Z')
    expect(computeStanding([], member, settings({ monthlyGraceDays: 25 }), now).standing).toBe('PAID_UP')
    expect(computeStanding([], member, settings({ monthlyGraceDays: 5 }), new Date('2026-10-07T00:00:00Z')).standing).toBe('LAPSED')
  })

  it('does not reactivate on a partial payment', () => {
    const result = computeStanding([monthly(300, '2026-10-18T00:00:00Z')], member, settings(), new Date('2026-10-20T00:00:00Z'))
    expect(result.standing).toBe('LAPSED')
    expect(result.monthlyArrearsKes).toBe(200)
  })

  it('reactivates once the full required amount is paid', () => {
    const payments = [monthly(300, '2026-10-18T00:00:00Z'), monthly(200, '2026-10-19T00:00:00Z')]
    const result = computeStanding(payments, member, settings(), new Date('2026-10-20T00:00:00Z'))
    expect(result.standing).toBe('PAID_UP')
  })

  it('ignores months before the member joined', () => {
    const joined = { ...member, joinedAt: new Date('2026-11-05T00:00:00Z') }
    const result = computeStanding([], joined, settings(), new Date('2026-11-20T00:00:00Z'))
    expect(result.standing).toBe('PAID_UP')
  })

  it('charges annual subscriptions by calendar year with a renewal window from 1 January', () => {
    const s = settings({ monthlyFeeKes: 0, annualFeeKes: 1200, effectiveFrom: new Date('2025-01-01T00:00:00Z') })
    const payments = [annual(1200, '2025-03-01T00:00:00Z')]
    expect(computeStanding(payments, member, s, new Date('2026-02-14T12:00:00Z')).standing).toBe('PAID_UP')
    const late = computeStanding(payments, member, s, new Date('2026-02-16T00:00:00Z'))
    expect(late.standing).toBe('LAPSED')
    expect(late.reason).toBe('2026 annual subscription unpaid')
    expect(computeStanding([...payments, annual(1200, '2026-03-10T00:00:00Z')], member, s, new Date('2026-03-11T00:00:00Z')).standing).toBe('PAID_UP')
  })

  it('starts annual dues the January after a mid-year start date', () => {
    const s = settings({ monthlyFeeKes: 0, annualFeeKes: 1200, effectiveFrom: new Date('2026-10-01T00:00:00Z') })
    expect(computeStanding([], member, s, new Date('2026-12-31T00:00:00Z')).standing).toBe('PAID_UP')
    expect(computeStanding([], member, s, new Date('2027-02-16T00:00:00Z')).standing).toBe('LAPSED')
    expect(annualExpiry([annual(600, '2026-12-01T00:00:00Z'), annual(600, '2027-01-05T00:00:00Z')], 1200, new Date('2026-10-01T00:00:00Z')).toISOString()).toBe('2028-01-01T00:00:00.000Z')
  })

  it('applies an Admin override until its end date', () => {
    const overridden = { ...member, override: 'PAID_UP' as const, overrideUntil: new Date('2026-11-01T00:00:00Z') }
    expect(computeStanding([], overridden, settings(), new Date('2026-10-20T00:00:00Z')).standing).toBe('PAID_UP')
    expect(computeStanding([], overridden, settings(), new Date('2026-11-02T00:00:00Z')).standing).toBe('LAPSED')
  })
})

describe('hasPaidUpAccess', () => {
  it('never blocks Admin or Super Admin', () => {
    expect(hasPaidUpAccess({ role: 'ADMIN', standing: 'LAPSED' })).toBe(true)
    expect(hasPaidUpAccess({ role: 'MEMBER', isSuperAdmin: true, standing: 'LAPSED' })).toBe(true)
    expect(hasPaidUpAccess({ role: 'MEMBER', standing: 'LAPSED' })).toBe(false)
  })
})

describe('deadline previews', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
  const iso = (date: Date) => date.toISOString().slice(0, 10)

  it('lists the last day to pay for upcoming monthly fees', () => {
    const rows = upcomingMonthlyDeadlines(day('2026-10-04'), 15, day('2026-10-01'))
    expect(rows.map((row) => [iso(row.month), iso(row.lastDay)])).toEqual([
      ['2026-10-01', '2026-11-15'],
      ['2026-11-01', '2026-12-15'],
      ['2026-12-01', '2027-01-15'],
    ])
  })

  it('rolls long grace periods across month lengths', () => {
    const rows = upcomingMonthlyDeadlines(day('2026-10-04'), 45, day('2026-10-01'), 1)
    expect(iso(rows[0].lastDay)).toBe('2026-12-15')
  })

  it('includes an earlier month that is still inside its grace period', () => {
    const rows = upcomingMonthlyDeadlines(day('2026-10-04'), 15, day('2026-09-01'), 1)
    expect([iso(rows[0].month), iso(rows[0].lastDay)]).toEqual(['2026-09-01', '2026-10-15'])
  })

  it('gives the last renewal day after an annual expiry', () => {
    expect(iso(annualLastRenewalDay(day('2027-01-01'), 45))).toBe('2027-02-14')
  })

  it('keeps a picked monthly day, falling back to month end in short months', () => {
    const rows = upcomingMonthlyDeadlines(day('2026-12-20'), 31, day('2026-10-01'), 3)
    expect(rows.map((row) => iso(row.lastDay))).toEqual(['2026-12-31', '2027-01-31', '2027-02-28'])
  })

  it('uses a fixed yearly due date when one is set', () => {
    const rule = { annualRenewalDays: 45, annualDueDate: '03-15' }
    expect(iso(upcomingAnnualRenewalDay(day('2026-10-04'), rule, day('2026-10-01')))).toBe('2027-03-15')
    expect(iso(upcomingAnnualRenewalDay(day('2027-03-16'), rule, day('2026-10-01')))).toBe('2028-03-15')
    const s = settings({ monthlyFeeKes: 0, annualFeeKes: 1200, annualDueDate: '03-15', effectiveFrom: day('2026-10-01') })
    expect(computeStanding([], member, s, new Date('2027-03-15T23:00:00Z')).standing).toBe('PAID_UP')
    expect(computeStanding([], member, s, new Date('2027-03-16T01:00:00Z')).standing).toBe('LAPSED')
  })

  it('previews the next annual deadline as 45 days into the next charged January', () => {
    expect(iso(upcomingAnnualRenewalDay(day('2026-10-04'), 45, day('2026-10-01')))).toBe('2027-02-14')
    expect(iso(upcomingAnnualRenewalDay(day('2026-02-01'), 45, day('2025-01-01')))).toBe('2026-02-14')
    expect(iso(upcomingAnnualRenewalDay(day('2026-03-01'), 45, day('2025-01-01')))).toBe('2027-02-14')
  })
})

describe('family standing', () => {
  const now = new Date('2026-10-04T00:00:00Z')
  const lapsed = { standing: 'LAPSED' as const, reason: 'October 2026 monthly fee unpaid', monthlyArrearsKes: 500, annualExpiresAt: null }
  const paid = { standing: 'PAID_UP' as const, reason: null, monthlyArrearsKes: 0, annualExpiresAt: null }

  it('treats under-18s and members without contribution rights as dependents', () => {
    expect(isDependent({ contributionExempt: false, dateOfBirth: new Date('2010-01-01T00:00:00Z') }, now)).toBe(true)
    expect(isDependent({ contributionExempt: false, dateOfBirth: new Date('2008-10-03T00:00:00Z') }, now)).toBe(false)
    expect(isDependent({ contributionExempt: true, dateOfBirth: null }, now)).toBe(true)
    expect(isDependent({ contributionExempt: false, dateOfBirth: null }, now)).toBe(false)
  })

  it('keeps independent adults on their own payments whatever the Principal does', () => {
    expect(resolveFamilyStanding(lapsed, { manual: false, dependent: false, principalStanding: 'PAID_UP' }).standing).toBe('LAPSED')
    expect(resolveFamilyStanding(paid, { manual: false, dependent: false, principalStanding: 'LAPSED' }).standing).toBe('PAID_UP')
  })

  it('makes dependents follow their Principal', () => {
    expect(resolveFamilyStanding(lapsed, { manual: false, dependent: true, principalStanding: 'PAID_UP' }).standing).toBe('PAID_UP')
    expect(resolveFamilyStanding(paid, { manual: false, dependent: true, principalStanding: 'LAPSED' }).standing).toBe('LAPSED')
    expect(resolveFamilyStanding(lapsed, { manual: false, dependent: true, principalStanding: null }).standing).toBe('PAID_UP')
  })

  it('lets a manual Admin setting win', () => {
    expect(resolveFamilyStanding(lapsed, { manual: true, dependent: true, principalStanding: 'PAID_UP' }).standing).toBe('LAPSED')
  })
})

describe('contribution plan', () => {
  // Both fees configured; on 20 Oct 2026 September's monthly fee is overdue and 2026's annual fee is due.
  const both = settings({ monthlyFeeKes: 500, annualFeeKes: 6000, annualDueDate: '03-31', effectiveFrom: new Date('2026-01-01T00:00:00Z') })
  const now = new Date('2026-10-20T00:00:00Z')
  const yearPaid = [annual(6000, '2026-02-01T00:00:00Z')]

  it('checks only the annual fee for annual members', () => {
    expect(computeStanding(yearPaid, { ...member, plan: 'ANNUAL' }, both, now).standing).toBe('PAID_UP')
    expect(computeStanding([], { ...member, plan: 'ANNUAL' }, both, now).reason).toMatch(/annual/)
  })

  it('checks only monthly fees for monthly members', () => {
    const result = computeStanding(yearPaid, { ...member, plan: 'MONTHLY' }, both, now)
    expect(result.standing).toBe('LAPSED')
    expect(result.reason).toMatch(/monthly/)
    expect(result.reason).not.toMatch(/annual/)
  })

  it('checks both when no plan is set', () => {
    const result = computeStanding([], { ...member, plan: null }, both, now)
    expect(result.reason).toMatch(/monthly/)
    expect(result.reason).toMatch(/annual/)
  })
})
