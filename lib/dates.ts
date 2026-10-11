/**
 * Bounds for `<input type="date">` and `<input type="datetime-local">` fields.
 *
 * Forward-looking fields (a repayment date, an event start, a milestone due date)
 * must never accept a date in the past; backward-looking fields (a date of birth,
 * the date a payment occurred) must never accept one in the future.
 *
 * `toISOString()` is deliberately avoided here: it converts to UTC, so in Kenya
 * (UTC+3) it reports yesterday's date for any local time before 03:00.
 */

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** `YYYY-MM-DD` for the given date, in local time. */
export function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `YYYY-MM-DDTHH:mm` for the given date, in local time. */
export function toDateTimeInputValue(date: Date) {
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Today — the earliest value a forward-looking `type="date"` field may accept. */
export function todayInputValue() {
  return toDateInputValue(new Date())
}

/** Tomorrow — for forward-looking fields that must be strictly after today. */
export function tomorrowInputValue() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return toDateInputValue(tomorrow)
}

/** Now — the earliest value a forward-looking `type="datetime-local"` field may accept. */
export function nowInputValue() {
  return toDateTimeInputValue(new Date())
}

/**
 * Relaxes a lower bound so an existing record whose stored value already predates
 * it stays editable — without that, a past event could never be saved again.
 */
export function lowerBoundFor(minimum: string, currentValue?: string | null) {
  return currentValue && currentValue < minimum ? currentValue : minimum
}

/** Midnight this morning — the server-side cut-off for "not in the past". */
export function startOfToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

/** Throws when `date` falls before today, for server actions guarding a future-only field. */
export function assertNotPast(date: Date | null | undefined, label: string) {
  if (date && date < startOfToday()) throw new Error(`${label} cannot be in the past.`)
}

/**
 * Throws when `date` falls after today in the group's timezone, for server actions guarding a
 * past-only field. A `YYYY-MM-DD` value parses as UTC midnight, which is still "the future" on a
 * UTC server between 00:00 and 03:00 in Kenya, so the cut-off is the end of the local day.
 */
export function assertNotFuture(date: Date | null | undefined, label: string) {
  if (date && date.getTime() > todayRange().end.getTime()) throw new Error(`${label} cannot be in the future.`)
}

/**
 * The group's operating timezone. Server processes often run in UTC, so "today" must be
 * resolved against this rather than the host clock, or members in Kenya see the wrong day
 * for the first three hours after midnight.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Nairobi'

/** Milliseconds that `timeZone` is ahead of UTC at the given instant. */
function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second'),
  )
  return asUtc - date.getTime()
}

/** Today's `YYYY-MM-DD` in the group's timezone, safe to compute on a UTC server. */
export function appTodayInputValue(now: Date = new Date(), timeZone: string = APP_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** First and last instants of "today" as experienced in the group's timezone. */
export function todayRange(now: Date = new Date(), timeZone: string = APP_TIMEZONE) {
  const offset = timezoneOffsetMs(now, timeZone)
  const local = new Date(now.getTime() + offset)
  const startOfLocalDay = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  )
  return {
    start: new Date(startOfLocalDay - offset),
    end: new Date(startOfLocalDay + 24 * 60 * 60 * 1000 - 1 - offset),
  }
}

/**
 * First and last instants of a calendar day (`YYYY-MM-DD`) as experienced in the group's timezone.
 * Use for date-range filters so a payment at 01:00 Nairobi time lands on the right day.
 */
export function appDayRange(value: string, timeZone: string = APP_TIMEZONE) {
  const [year, month, day] = value.split('-').map(Number)
  const midnightUtc = Date.UTC(year, month - 1, day)
  // The offset is measured at that day's noon, safely away from any midnight transition.
  const offset = timezoneOffsetMs(new Date(midnightUtc + 12 * 60 * 60 * 1000), timeZone)
  return {
    start: new Date(midnightUtc - offset),
    end: new Date(midnightUtc + 24 * 60 * 60 * 1000 - 1 - offset),
  }
}
