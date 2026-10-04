export type Standing = 'PAID_UP' | 'LAPSED'

export type StandingSettings = {
  autoEnabled: boolean
  monthlyFeeKes: number
  monthlyGraceDays: number
  annualFeeKes: number
  annualRenewalDays: number
  /** Rules only look at dues from this date onward, so historic months are never charged. */
  effectiveFrom: Date
}

export const DEFAULT_STANDING_SETTINGS: Omit<StandingSettings, 'effectiveFrom'> = {
  autoEnabled: true,
  monthlyFeeKes: 0,
  monthlyGraceDays: 15,
  annualFeeKes: 0,
  annualRenewalDays: 45,
}

export type StandingPayment = {
  amount: number
  billingKind: 'MONTHLY' | 'ANNUAL'
  paidAt: Date
}

export type StandingMember = {
  joinedAt: Date
  override: Standing | null
  overrideUntil: Date | null
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

/** Month M is due by month end; it becomes overdue once `graceDays` of month M+1 have passed. */
export function monthlyDeadline(month: Date, graceDays: number) {
  return new Date(addMonths(monthStart(month), 1).getTime() + graceDays * DAY_MS)
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
 * Walks annual payments in date order; every time the running total covers one full
 * subscription, coverage extends 12 months from the later of the payment or the current expiry.
 */
export function annualExpiry(payments: StandingPayment[], feeKes: number, start: Date) {
  let expiry = start
  let running = 0
  const annual = payments
    .filter((payment) => payment.billingKind === 'ANNUAL')
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
  for (const payment of annual) {
    running += payment.amount
    while (running + 0.0001 >= feeKes) {
      running -= feeKes
      expiry = addMonths(expiry > payment.paidAt ? expiry : payment.paidAt, 12)
    }
  }
  return expiry
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
  if (!settings.autoEnabled) return base

  const start = member.joinedAt > settings.effectiveFrom ? member.joinedAt : settings.effectiveFrom
  const reasons: string[] = []
  let result = { ...base }

  if (settings.monthlyFeeKes > 0) {
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

  if (settings.annualFeeKes > 0) {
    const expiry = annualExpiry(payments, settings.annualFeeKes, start)
    result.annualExpiresAt = expiry
    if (now.getTime() > expiry.getTime() + settings.annualRenewalDays * DAY_MS) {
      reasons.push(`Annual subscription not renewed (expired ${expiry.toLocaleDateString('en-KE')})`)
    }
  }

  if (reasons.length) result = { ...result, standing: 'LAPSED', reason: reasons.join('; ') }
  return result
}

/** Admin, Super Admin and staff with full access are never blocked by standing. */
export function hasPaidUpAccess(user: { role: string; isSuperAdmin?: boolean; standing: Standing }) {
  return user.isSuperAdmin || user.role === 'ADMIN' || user.standing === 'PAID_UP'
}
