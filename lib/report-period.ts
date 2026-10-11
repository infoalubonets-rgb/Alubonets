import { appDayRange } from '@/lib/dates'

export function currentCalendarYearRange(now = new Date()) {
  const year = now.getFullYear()
  return {
    year,
    from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Report range from query values. A plain `YYYY-MM-DD` means the whole of that day in the
 * group's timezone, so `to=2026-10-31` includes payments made on the 31st. Full timestamps are
 * used as given.
 */
export function reportRangeFromSearch(fromValue: string | null, toValue: string | null, now = new Date()) {
  const fallback = currentCalendarYearRange(now)
  return {
    from: fromValue ? (DATE_ONLY.test(fromValue) ? appDayRange(fromValue).start : new Date(fromValue)) : fallback.from,
    to: toValue ? (DATE_ONLY.test(toValue) ? appDayRange(toValue).end : new Date(toValue)) : fallback.to,
  }
}
