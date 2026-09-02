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

/** Throws when `date` falls after now, for server actions guarding a past-only field. */
export function assertNotFuture(date: Date | null | undefined, label: string) {
  if (date && date.getTime() > Date.now()) throw new Error(`${label} cannot be in the future.`)
}
