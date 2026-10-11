import { describe, expect, it } from 'vitest'
import { appliesToMember, purposeBalance, purposeDeadline, purposeRuleSchema, type PurposeRule } from '../lib/contribution-purpose-rules'
const rule = (patch: Partial<PurposeRule> = {}): PurposeRule => ({ categoryId: 'dues', amountKes: 100, frequency: 'MONTHLY', deadline: '2026-01-10', graceDays: 2, memberContribution: true, scope: 'ALL', memberIds: [], ...patch })
const joined = new Date('2025-01-01T00:00:00Z')
describe('contribution purpose schedules', () => {
  it('repeats the chosen day and clamps short months without drifting', () => {
    const r = rule({ deadline: '2026-01-31' })
    expect(purposeDeadline(r, 1).toISOString().slice(0, 10)).toBe('2026-02-28')
    expect(purposeDeadline(r, 2).toISOString().slice(0, 10)).toBe('2026-03-31')
  })
  it('keeps the annual month/day and handles leap years', () => {
    const r = rule({ frequency: 'ANNUAL', deadline: '2024-02-29' })
    expect(purposeDeadline(r, 1).toISOString().slice(0, 10)).toBe('2025-02-28')
    expect(purposeDeadline(r, 4).toISOString().slice(0, 10)).toBe('2028-02-29')
  })
  it('does not mark overdue until the grace period ends in Nairobi', () => {
    expect(purposeBalance(rule(), joined, [], new Date('2026-01-12T20:59:59Z')).outstanding).toBe(0)
    expect(purposeBalance(rule(), joined, [], new Date('2026-01-12T21:00:00Z')).outstanding).toBe(100)
  })
  it('counts recurring obligations, partial payments and prepayments once', () => {
    const r = purposeBalance(rule(), joined, [{ amount: 150, paidAt: new Date('2026-01-05') }], new Date('2026-02-13'))
    expect(r.overduePeriods).toBe(2)
    expect(r.outstanding).toBe(50)
    expect(r.nextDeadline?.toISOString().slice(0, 10)).toBe('2026-03-10')
  })
  it('does not charge cycles before membership starts', () => {
    expect(purposeBalance(rule(), new Date('2026-02-15'), [], new Date('2026-03-13')).outstanding).toBe(100)
  })
  it('charges one-time purposes only once', () => {
    const r = purposeBalance(rule({ frequency: 'ONCE', memberContribution: false }), joined, [], new Date('2028-01-01'))
    expect(r.overduePeriods).toBe(1)
    expect(r.nextDeadline).toBeNull()
  })
  it('applies only to the configured member audience', () => {
    expect(appliesToMember(rule({ scope: 'NONE' }), 'a')).toBe(false)
    expect(appliesToMember(rule({ scope: 'SELECTED', memberIds: ['a'] }), 'a')).toBe(true)
    expect(appliesToMember(rule({ scope: 'SELECTED', memberIds: ['a'] }), 'b')).toBe(false)
  })
  it('rejects impossible dates, negative amounts and incomplete selected-member rules', () => {
    expect(purposeRuleSchema.safeParse(rule({ deadline: '2026-02-30' })).success).toBe(false)
    expect(purposeRuleSchema.safeParse(rule({ amountKes: -1 })).success).toBe(false)
    expect(purposeRuleSchema.safeParse(rule({ scope: 'SELECTED', memberIds: [] })).success).toBe(false)
    expect(purposeRuleSchema.safeParse(rule({ frequency: 'ONCE' })).success).toBe(false)
  })
})
