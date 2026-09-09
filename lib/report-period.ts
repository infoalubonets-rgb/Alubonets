export function currentCalendarYearRange(now = new Date()) {
  const year = now.getFullYear()
  return {
    year,
    from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  }
}

export function reportRangeFromSearch(fromValue: string | null, toValue: string | null, now = new Date()) {
  const fallback = currentCalendarYearRange(now)
  return {
    from: fromValue ? new Date(fromValue) : fallback.from,
    to: toValue ? new Date(toValue) : fallback.to,
  }
}
