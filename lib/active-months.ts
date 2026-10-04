export type ActiveMonthPayment = {
  amount: number
  billingKind: 'MONTHLY' | 'ANNUAL'
  /** YYYY-MM the payment covers; falls back to the month it was paid. */
  period: string | null
  paidAt: Date
}

export type ActiveMonthsResult = {
  /** YYYY-MM keys that are fully paid. */
  activeMonths: string[]
  /** Credit left over after filling months (KES). */
  creditKes: number
}

export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

export function shiftMonth(key: string, months: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + months, 1))
  return monthKey(date)
}

export function monthsOfYear(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
}

/**
 * A month is active when the monthly fee for it is fully paid. Payments fill their own month first
 * and carry any extra into the following months, so paying three months at once covers all three.
 * A full annual subscription covers the 12 months starting from the month it was paid.
 * With a monthly fee of 0, any monthly payment marks its month active.
 */
export function computeActiveMonths(
  payments: ActiveMonthPayment[],
  monthlyFeeKes: number,
  annualFeeKes = 0,
): ActiveMonthsResult {
  const active = new Set<string>()
  const filled = new Map<string, number>()
  let credit = 0

  const monthly = payments
    .filter((payment) => payment.billingKind === 'MONTHLY' && payment.amount > 0)
    .map((payment) => ({ ...payment, key: payment.period || monthKey(payment.paidAt) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.paidAt.getTime() - b.paidAt.getTime())

  for (const payment of monthly) {
    if (monthlyFeeKes <= 0) {
      active.add(payment.key)
      continue
    }
    let remaining = payment.amount
    let key = payment.key
    let guard = 0
    while (remaining > 0.0001 && guard < 1200) {
      const have = filled.get(key) ?? 0
      const need = monthlyFeeKes - have
      if (need <= 0.0001) {
        key = shiftMonth(key, 1)
        guard++
        continue
      }
      const used = Math.min(need, remaining)
      filled.set(key, have + used)
      remaining -= used
      if (have + used + 0.0001 >= monthlyFeeKes) active.add(key)
      key = shiftMonth(key, 1)
      guard++
    }
    credit += Math.max(0, remaining)
  }

  if (annualFeeKes > 0) {
    let running = 0
    const annual = payments
      .filter((payment) => payment.billingKind === 'ANNUAL')
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
    let coveredUntil = ''
    for (const payment of annual) {
      running += payment.amount
      while (running + 0.0001 >= annualFeeKes) {
        running -= annualFeeKes
        const paidKey = payment.period || monthKey(payment.paidAt)
        const start = coveredUntil && coveredUntil > paidKey ? coveredUntil : paidKey
        for (let index = 0; index < 12; index++) active.add(shiftMonth(start, index))
        coveredUntil = shiftMonth(start, 12)
      }
    }
  }

  return { activeMonths: [...active].sort(), creditKes: Math.round(credit * 100) / 100 }
}
