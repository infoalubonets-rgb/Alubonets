import { describe, expect, it } from 'vitest'
import { PERIOD_GRACE_DAYS, currentAccountingMonth, periodAutoClosesAt, periodFields, periodOpenBlocker } from '../lib/finance'

describe('which months can be opened', () => {
  const september = { year: 2026, month: 9 }

  it('always allows the current month, even with no data', () => {
    expect(periodOpenBlocker(september, september, false)).toBeNull()
  })

  it('never allows a future month', () => {
    expect(periodOpenBlocker({ year: 2026, month: 12 }, september, false)).toMatch(/future/)
    expect(periodOpenBlocker({ year: 2027, month: 1 }, september, true)).toMatch(/future/)
  })

  it('allows a past month only when it has data', () => {
    expect(periodOpenBlocker({ year: 2026, month: 8 }, september, true)).toBeNull()
    expect(periodOpenBlocker({ year: 2026, month: 3 }, september, false)).toMatch(/no data/)
  })

  it('reads the current month in Kenya time, not UTC', () => {
    // 22:30 UTC on 30 Sep is already 1 Oct in Nairobi.
    expect(currentAccountingMonth(new Date('2026-09-30T22:30:00Z'))).toEqual({ year: 2026, month: 10 })
  })
})

describe('accounting period auto-close', () => {
  it('closes a month 7 days after it ends', () => {
    expect(PERIOD_GRACE_DAYS).toBe(7)
    expect(periodAutoClosesAt(2026, 10).toISOString()).toBe('2026-11-08T00:00:00.000Z')
    expect(periodAutoClosesAt(2026, 12).toISOString()).toBe('2027-01-08T00:00:00.000Z')
    expect(periodAutoClosesAt(2027, 2).toISOString()).toBe('2027-03-08T00:00:00.000Z')
  })

  it('tags new transactions only when their month is closed', () => {
    expect(periodFields({ id: 'p1', status: 'OPEN' })).toEqual({ periodId: 'p1', addedAfterClose: false })
    expect(periodFields({ id: 'p2', status: 'CLOSED' })).toEqual({ periodId: 'p2', addedAfterClose: true })
  })
})
