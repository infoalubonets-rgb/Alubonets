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
    // A plain date starts at midnight Nairobi time (UTC+3).
    expect(range.from.toISOString()).toBe('2025-01-31T21:00:00.000Z')
    expect(range.to.getUTCFullYear()).toBe(2025)
  })
})

describe('report period day boundaries', () => {
  it('treats a plain To date as the whole Nairobi day', () => {
    const range = reportRangeFromSearch('2026-10-01', '2026-10-31')
    expect(range.from.toISOString()).toBe('2026-09-30T21:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-31T20:59:59.999Z')
  })
})
