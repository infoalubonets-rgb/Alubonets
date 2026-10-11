import { appDayRange, appTodayInputValue } from '@/lib/dates'

/**
 * One time filter for the finance pages. Presets: last 24 hours (exact hours), this week,
 * last 7 days, last 30 days; or a custom start/end date. Dates are whole days in the group's
 * timezone, so a payment at 01:00 Nairobi time lands on the right day.
 */
export const TIME_RANGES = [
  { key: 'all', label: 'All time' },
  { key: '24h', label: 'Last 24 hours' },
  { key: 'week', label: 'This week' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
] as const
export type TimeRangeKey = (typeof TIME_RANGES)[number]['key']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

export type TimeRangeInput = { range?: string | null; from?: string | null; to?: string | null }
export type ResolvedTimeRange = { key: TimeRangeKey; from: string; to: string; gte?: Date; lte?: Date; label: string }

const shortDate = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function shiftDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Turns query values into database bounds and a label. Unknown or empty input means all time. */
export function resolveTimeRange(input: TimeRangeInput, now: Date = new Date()): ResolvedTimeRange {
  const key = TIME_RANGES.some((r) => r.key === input.range) ? (input.range as TimeRangeKey) : undefined
  if (key === '24h') {
    return { key, from: '', to: '', gte: new Date(now.getTime() - DAY_MS), lte: now, label: 'Last 24 hours' }
  }
  const today = appTodayInputValue(now)
  let from = DATE_RE.test(input.from ?? '') ? input.from! : ''
  let to = DATE_RE.test(input.to ?? '') ? input.to! : ''
  // Presets are recomputed from today so a bookmarked link stays current.
  if (key === '7') { from = shiftDays(today, -6); to = today }
  if (key === '30') { from = shiftDays(today, -29); to = today }
  if (key === 'week') {
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
    from = shiftDays(today, -weekday); to = today
  }
  if (from && to && from > to) [from, to] = [to, from]
  if (!from && !to) return { key: 'all', from: '', to: '', label: 'All time' }
  const resolvedKey: TimeRangeKey = key && key !== 'all' ? key : 'custom'
  const label = TIME_RANGES.find((r) => r.key === resolvedKey && r.key !== 'custom')?.label
    ?? `${from ? shortDate(from) : 'Start'} – ${to ? shortDate(to) : 'today'}`
  return {
    key: resolvedKey,
    from,
    to,
    gte: from ? appDayRange(from).start : undefined,
    lte: to ? appDayRange(to).end : undefined,
    label,
  }
}

/** Prisma date filter for a resolved range, or undefined for all time. */
export function rangeFilter(range: ResolvedTimeRange) {
  return range.gte || range.lte ? { ...(range.gte ? { gte: range.gte } : {}), ...(range.lte ? { lte: range.lte } : {}) } : undefined
}
