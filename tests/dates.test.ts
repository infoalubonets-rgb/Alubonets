import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertNotFuture,
  assertNotPast,
  lowerBoundFor,
  nowInputValue,
  startOfToday,
  toDateInputValue,
  toDateTimeInputValue,
  todayInputValue,
  todayRange,
  tomorrowInputValue,
} from '../lib/dates'

afterEach(() => vi.useRealTimers())

describe('input value formatting', () => {
  it('formats a date in local time, not UTC', () => {
    // 00:30 local on the 5th: toISOString() would report the 4th anywhere east of UTC.
    const date = new Date(2026, 2, 5, 0, 30)
    expect(toDateInputValue(date)).toBe('2026-03-05')
    expect(toDateTimeInputValue(date)).toBe('2026-03-05T00:30')
  })

  it('zero-pads single-digit months, days, hours and minutes', () => {
    expect(toDateTimeInputValue(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04')
  })

  it('reports today, tomorrow and now against the current clock', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 27, 14, 5))
    expect(todayInputValue()).toBe('2026-08-27')
    expect(tomorrowInputValue()).toBe('2026-08-28')
    expect(nowInputValue()).toBe('2026-08-27T14:05')
  })

  it('rolls tomorrow over a month boundary', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 31, 9, 0))
    expect(tomorrowInputValue()).toBe('2026-09-01')
  })
})

describe('lowerBoundFor', () => {
  it('keeps the minimum when there is no stored value', () => {
    expect(lowerBoundFor('2026-08-27', null)).toBe('2026-08-27')
    expect(lowerBoundFor('2026-08-27', undefined)).toBe('2026-08-27')
    expect(lowerBoundFor('2026-08-27', '')).toBe('2026-08-27')
  })

  it('keeps the minimum when the stored value is already at or after it', () => {
    expect(lowerBoundFor('2026-08-27', '2026-08-27')).toBe('2026-08-27')
    expect(lowerBoundFor('2026-08-27', '2026-12-01')).toBe('2026-08-27')
  })

  it('relaxes to the stored value so an existing past record stays editable', () => {
    expect(lowerBoundFor('2026-08-27', '2026-01-04')).toBe('2026-01-04')
    expect(lowerBoundFor('2026-08-27T14:05', '2026-08-27T09:00')).toBe('2026-08-27T09:00')
  })
})

describe('assertNotPast', () => {
  it('rejects a date before today', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 27, 14, 5))
    expect(() => assertNotPast(new Date(2026, 7, 26, 23, 59), 'Event date')).toThrow(
      'Event date cannot be in the past.',
    )
  })

  it('accepts any time today, including one already elapsed', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 27, 14, 5))
    expect(() => assertNotPast(startOfToday(), 'Event date')).not.toThrow()
    expect(() => assertNotPast(new Date(2026, 7, 27, 9, 0), 'Event date')).not.toThrow()
    expect(() => assertNotPast(new Date(2026, 7, 28), 'Event date')).not.toThrow()
  })

  it('treats an absent optional date as valid', () => {
    expect(() => assertNotPast(null, 'Due date')).not.toThrow()
    expect(() => assertNotPast(undefined, 'Due date')).not.toThrow()
  })
})

describe('assertNotFuture', () => {
  it('rejects a date after now', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 27, 14, 5))
    expect(() => assertNotFuture(new Date(2026, 7, 28), 'Payment date')).toThrow(
      'Payment date cannot be in the future.',
    )
  })

  it('accepts now and earlier', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 27, 14, 5))
    expect(() => assertNotFuture(new Date(2026, 7, 27, 14, 5), 'Payment date')).not.toThrow()
    expect(() => assertNotFuture(new Date(2020, 0, 1), 'Payment date')).not.toThrow()
  })

  it('treats an absent optional date as valid', () => {
    expect(() => assertNotFuture(null, 'Payment date')).not.toThrow()
  })

  it("accepts today's date shortly after midnight in Kenya", () => {
    // 01:33 in Nairobi is still 22:33 the previous day in UTC.
    vi.useFakeTimers().setSystemTime(new Date('2026-10-10T22:33:00Z'))
    expect(() => assertNotFuture(new Date('2026-10-11'), 'Contribution date')).not.toThrow()
    expect(() => assertNotFuture(new Date('2026-10-12'), 'Contribution date')).toThrow(
      'Contribution date cannot be in the future.',
    )
  })
})

describe('todayRange', () => {
  it('spans a full day in the group timezone, not the server timezone', () => {
    // 00:30 UTC is already 03:30 the same day in Nairobi (UTC+3).
    const { start, end } = todayRange(new Date('2026-09-09T00:30:00.000Z'), 'Africa/Nairobi')
    // Local midnight in Nairobi is 21:00 UTC the previous day.
    expect(start.toISOString()).toBe('2026-09-08T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-09T20:59:59.999Z')
  })

  it('rolls to the next day once local midnight passes', () => {
    // 21:30 UTC is 00:30 the NEXT day in Nairobi, so "today" must have advanced.
    const { start } = todayRange(new Date('2026-09-09T21:30:00.000Z'), 'Africa/Nairobi')
    expect(start.toISOString()).toBe('2026-09-09T21:00:00.000Z')
  })

  it('always covers exactly one day', () => {
    const { start, end } = todayRange(new Date('2026-09-09T12:00:00.000Z'), 'Africa/Nairobi')
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })
})

describe('appDayRange', () => {
  it('covers a whole Nairobi calendar day', async () => {
    const { appDayRange } = await import('../lib/dates')
    const { start, end } = appDayRange('2026-10-11', 'Africa/Nairobi')
    // Nairobi is UTC+3: the day runs 10 Oct 21:00 UTC to 11 Oct 20:59:59.999 UTC.
    expect(start.toISOString()).toBe('2026-10-10T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-11T20:59:59.999Z')
  })
})
