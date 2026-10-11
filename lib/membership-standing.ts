export type Standing = 'PAID_UP' | 'LAPSED'

export type StandingSettings = {
  monthlyFeeKes: number
  monthlyGraceDays: number
  annualFeeKes: number
  annualRenewalDays: number
  /** Fixed yearly deadline as `MM-DD`; when set it replaces `annualRenewalDays`. */
  annualDueDate: string | null
  /** Rules only look at dues from this date onward, so historic months are never charged. */
  effectiveFrom: Date
}

export const DEFAULT_STANDING_SETTINGS: Omit<StandingSettings, 'effectiveFrom'> = {
  monthlyFeeKes: 0,
  monthlyGraceDays: 15,
  annualFeeKes: 0,
  annualRenewalDays: 45,
  annualDueDate: null,
}

export type AnnualDeadlineRule = Pick<StandingSettings, 'annualRenewalDays' | 'annualDueDate'>

export const ANNUAL_DUE_DATE_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export type StandingPayment = {
  amount: number
  billingKind: 'MONTHLY' | 'ANNUAL'
  paidAt: Date
}

export type StandingMember = {
  joinedAt: Date
  override: Standing | null
  overrideUntil: Date | null
  /** Monthly members are only checked for monthly dues, annual members only for the annual fee. Unset checks both. */
  plan?: 'MONTHLY' | 'ANNUAL' | null
}

export type StandingResult = {
  standing: Standing
  reason: string | null
  /** Monthly dues still owed (KES), for display. */
  monthlyArrearsKes: number
  annualExpiresAt: Date | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()))
}

export function monthLabel(date: Date) {
  return date.toLocaleString('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Month M is due by month end; it becomes overdue once `graceDays` of month M+1 have passed.
 * A grace of 1–31 is a day of the month, so it falls back to the last day in shorter months.
 */
export function monthlyDeadline(month: Date, graceDays: number) {
  const next = addMonths(monthStart(month), 1)
  if (graceDays >= 1 && graceDays <= 31) {
    const day = Math.min(graceDays, daysInMonth(next.getUTCFullYear(), next.getUTCMonth()))
    return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), day) + DAY_MS)
  }
  return new Date(next.getTime() + graceDays * DAY_MS)
}

/** Last calendar day a month's fee can be paid before the member lapses. */
export function monthlyLastPayDay(month: Date, graceDays: number) {
  return new Date(monthlyDeadline(month, graceDays).getTime() - DAY_MS)
}

/** The next `count` monthly fees still payable on or after `today`, never before `from`. */
export function upcomingMonthlyDeadlines(today: Date, graceDays: number, from: Date, count = 3) {
  const earliest = monthStart(from)
  let month = monthStart(addMonths(today, -6))
  if (month < earliest) month = earliest
  const rows: { month: Date; lastDay: Date }[] = []
  while (rows.length < count) {
    const lastDay = monthlyLastPayDay(month, graceDays)
    if (lastDay >= today) rows.push({ month, lastDay })
    month = addMonths(month, 1)
  }
  return rows
}

/** Last calendar day to renew once an annual subscription expires at `expiry`. */
export function annualLastRenewalDay(expiry: Date, renewalDays: number) {
  return new Date(Math.max(expiry.getTime(), expiry.getTime() + (renewalDays - 1) * DAY_MS))
}

/** First calendar year charged: the year of `start` if it begins on 1 January, otherwise the next one. */
export function firstAnnualYear(start: Date) {
  const year = start.getUTCFullYear()
  return start.getTime() <= Date.UTC(year, 0, 1) ? year : year + 1
}

/** Last calendar day to pay year `year`'s subscription: the fixed due date, or 1 January + renewal window. */
export function annualLastPayDay(year: number, rule: AnnualDeadlineRule) {
  const match = rule.annualDueDate ? ANNUAL_DUE_DATE_PATTERN.exec(rule.annualDueDate) : null
  if (match) {
    const monthIndex = Number(match[1]) - 1
    return new Date(Date.UTC(year, monthIndex, Math.min(Number(match[2]), daysInMonth(year, monthIndex))))
  }
  return annualLastRenewalDay(new Date(Date.UTC(year, 0, 1)), rule.annualRenewalDays)
}

/** The next annual deadline on or after `today`, never before `from`'s first charged year. */
export function upcomingAnnualRenewalDay(today: Date, rule: AnnualDeadlineRule | number, from: Date) {
  const resolved = typeof rule === 'number' ? { annualRenewalDays: rule, annualDueDate: null } : rule
  let year = Math.max(firstAnnualYear(from), today.getUTCFullYear() - 1)
  let lastDay = annualLastPayDay(year, resolved)
  while (lastDay < today) {
    year += 1
    lastDay = annualLastPayDay(year, resolved)
  }
  return lastDay
}

/** Number of months, starting at `firstMonth`, whose grace deadline has passed by `now`. */
export function overdueMonthCount(firstMonth: Date, graceDays: number, now: Date) {
  let count = 0
  let month = monthStart(firstMonth)
  while (monthlyDeadline(month, graceDays) < now) {
    count += 1
    month = addMonths(month, 1)
    if (count > 1200) break
  }
  return count
}

/**
 * Annual subscriptions run by calendar year (January to December), starting at `firstAnnualYear(start)`.
 * Each full fee paid covers the next unpaid year; returns 1 January of the first year not yet covered.
 */
export function annualExpiry(payments: StandingPayment[], feeKes: number, start: Date) {
  const total = payments
    .filter((payment) => payment.billingKind === 'ANNUAL')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const yearsPaid = Math.floor((total + 0.0001) / feeKes)
  return new Date(Date.UTC(firstAnnualYear(start) + yearsPaid, 0, 1))
}

export function computeStanding(
  payments: StandingPayment[],
  member: StandingMember,
  settings: StandingSettings,
  now: Date = new Date(),
): StandingResult {
  const base: StandingResult = { standing: 'PAID_UP', reason: null, monthlyArrearsKes: 0, annualExpiresAt: null }

  if (member.override && (!member.overrideUntil || member.overrideUntil > now)) {
    return {
      ...base,
      standing: member.override,
      reason: member.overrideUntil
        ? `Set by Admin until ${member.overrideUntil.toLocaleDateString('en-KE')}`
        : 'Set by Admin',
    }
  }

  const start = member.joinedAt > settings.effectiveFrom ? member.joinedAt : settings.effectiveFrom
  const reasons: string[] = []
  let result = { ...base }

  if (settings.monthlyFeeKes > 0 && member.plan !== 'ANNUAL') {
    const firstMonth = monthStart(start)
    const due = overdueMonthCount(firstMonth, settings.monthlyGraceDays, now) * settings.monthlyFeeKes
    const paid = payments
      .filter((payment) => payment.billingKind === 'MONTHLY' && payment.paidAt >= firstMonth)
      .reduce((sum, payment) => sum + payment.amount, 0)
    if (paid + 0.0001 < due) {
      const firstUnpaid = addMonths(firstMonth, Math.floor(paid / settings.monthlyFeeKes))
      result.monthlyArrearsKes = Math.round((due - paid) * 100) / 100
      reasons.push(`${monthLabel(firstUnpaid)} monthly fee unpaid`)
    }
  }

  if (settings.annualFeeKes > 0 && member.plan !== 'MONTHLY') {
    const expiry = annualExpiry(payments, settings.annualFeeKes, start)
    result.annualExpiresAt = expiry
    if (now.getTime() > annualLastPayDay(expiry.getUTCFullYear(), settings).getTime() + DAY_MS) {
      reasons.push(`${expiry.getUTCFullYear()} annual subscription unpaid`)
    }
  }

  if (reasons.length) result = { ...result, standing: 'LAPSED', reason: reasons.join('; ') }
  return result
}

/** Under 18, or an Admin removed contribution rights: the member owes no dues of their own. */
export function isDependent(member: { contributionExempt: boolean; dateOfBirth: Date | null }, now: Date = new Date()) {
  if (member.contributionExempt) return true
  return Boolean(member.dateOfBirth && addMonths(member.dateOfBirth, 18 * 12) > now)
}

/**
 * Attached members are financially independent and keep their own result. Only dependents follow
 * their Principal; a dependent without a Principal has no dues and stays paid up.
 */
export function resolveFamilyStanding(
  own: StandingResult,
  opts: { manual: boolean; dependent: boolean; principalStanding: Standing | null },
): StandingResult {
  if (opts.manual || !opts.dependent) return own
  const base = { ...own, monthlyArrearsKes: 0, annualExpiresAt: null }
  if (opts.principalStanding === 'LAPSED') {
    return { ...base, standing: 'LAPSED', reason: 'Principal Member’s membership has lapsed' }
  }
  return { ...base, standing: 'PAID_UP', reason: null }
}

/** Admin, Super Admin and staff with full access are never blocked by standing. */
export function hasPaidUpAccess(user: { role: string; isSuperAdmin?: boolean; standing: Standing }) {
  return user.isSuperAdmin || user.role === 'ADMIN' || user.standing === 'PAID_UP'
}
