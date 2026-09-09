import { describe, expect, it } from 'vitest'
import { currentCalendarYearRange, reportRangeFromSearch } from '../lib/report-period'

describe('report period', () => {
  it('defaults to the current calendar year', () => {
    const now = new Date('2027-03-15T12:00:00Z')
    const range = currentCalendarYearRange(now)
    expect(range.year).toBe(2027)
    expect(range.from.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2027-12-31T23:59:59.999Z')
  })

  it('uses supplied from/to when present', () => {
    const range = reportRangeFromSearch('2025-02-01', '2025-02-28T23:59:59.999Z', new Date('2026-01-01'))
    expect(range.from.toISOString().startsWith('2025-02-01')).toBe(true)
    expect(range.to.getUTCFullYear()).toBe(2025)
  })
})
