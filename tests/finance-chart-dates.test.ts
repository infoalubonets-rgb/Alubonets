import { describe, expect, it } from 'vitest'
import { monthKeyFromDate } from '../lib/chart-labels'
import { appDayRange } from '../lib/dates'

describe('finance chart calendar boundaries', () => {
  it('groups a payment after Nairobi midnight into the new month on a UTC server', () => {
    expect(monthKeyFromDate(new Date('2026-09-30T21:05:00Z'))).toBe('2026-10')
    expect(monthKeyFromDate(new Date('2026-09-30T20:59:59Z'))).toBe('2026-09')
  })
  it('uses the same Nairobi boundary for monthly totals and chart buckets', () => {
    const first = appDayRange('2026-10-01').start
    expect(first.toISOString()).toBe('2026-09-30T21:00:00.000Z')
    expect(monthKeyFromDate(first)).toBe('2026-10')
    expect(monthKeyFromDate(new Date(first.getTime() - 1))).toBe('2026-09')
  })
})
