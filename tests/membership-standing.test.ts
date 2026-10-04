import { describe, expect, it } from 'vitest'
import {
  annualExpiry,
  computeStanding,
  hasPaidUpAccess,
  monthlyDeadline,
  overdueMonthCount,
  type StandingPayment,
  type StandingSettings,
} from '../lib/membership-standing'

const settings = (overrides: Partial<StandingSettings> = {}): StandingSettings => ({
  autoEnabled: true,
  monthlyFeeKes: 500,
  monthlyGraceDays: 15,
  annualFeeKes: 0,
  annualRenewalDays: 45,
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

  it('lapses when the annual subscription is not renewed within the renewal window', () => {
    const s = settings({ monthlyFeeKes: 0, annualFeeKes: 1200, effectiveFrom: new Date('2025-01-01T00:00:00Z') })
    const payments = [annual(1200, '2025-03-01T00:00:00Z')]
    expect(computeStanding(payments, member, s, new Date('2026-04-10T00:00:00Z')).standing).toBe('PAID_UP')
    const late = computeStanding(payments, member, s, new Date('2026-04-20T00:00:00Z'))
    expect(late.standing).toBe('LAPSED')
    expect(late.reason).toContain('Annual subscription')
    expect(computeStanding(payments, member, { ...s, annualRenewalDays: 90 }, new Date('2026-04-20T00:00:00Z')).standing).toBe('PAID_UP')
  })

  it('extends annual coverage from the current expiry when renewed early', () => {
    const expiry = annualExpiry([annual(1200, '2025-03-01T00:00:00Z'), annual(1200, '2026-02-01T00:00:00Z')], 1200, new Date('2025-01-01T00:00:00Z'))
    expect(expiry.toISOString().startsWith('2027-03-01')).toBe(true)
  })

  it('applies an Admin override until its end date', () => {
    const overridden = { ...member, override: 'PAID_UP' as const, overrideUntil: new Date('2026-11-01T00:00:00Z') }
    expect(computeStanding([], overridden, settings(), new Date('2026-10-20T00:00:00Z')).standing).toBe('PAID_UP')
    expect(computeStanding([], overridden, settings(), new Date('2026-11-02T00:00:00Z')).standing).toBe('LAPSED')
  })

  it('treats everyone as paid up when automatic standing is switched off', () => {
    const result = computeStanding([], member, settings({ autoEnabled: false }), new Date('2027-01-20T00:00:00Z'))
    expect(result.standing).toBe('PAID_UP')
  })
})

describe('hasPaidUpAccess', () => {
  it('never blocks Admin or Super Admin', () => {
    expect(hasPaidUpAccess({ role: 'ADMIN', standing: 'LAPSED' })).toBe(true)
    expect(hasPaidUpAccess({ role: 'MEMBER', isSuperAdmin: true, standing: 'LAPSED' })).toBe(true)
    expect(hasPaidUpAccess({ role: 'MEMBER', standing: 'LAPSED' })).toBe(false)
  })
})
