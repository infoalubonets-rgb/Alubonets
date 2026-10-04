import { prisma } from '@/lib/prisma'
import { computeActiveMonths, monthsOfYear, type ActiveMonthPayment } from '@/lib/active-months'
import { getStandingSettings } from '@/lib/membership-standing-settings'

export type ActiveMonthsRow = {
  userId: string
  fullName: string
  membershipNumber: string | null
  standing: string
  months: boolean[]
  activeCount: number
}

export async function getActiveMonthsReport(year: number) {
  const settings = await getStandingSettings()
  const [members, payments] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, membershipNumber: true, standing: true },
    }),
    prisma.contribution.findMany({
      where: {
        status: { in: ['CONFIRMED', 'RECONCILED'] },
        transactionCategory: { billingKind: { in: ['MONTHLY', 'ANNUAL'] } },
      },
      select: {
        userId: true,
        amount: true,
        paidAt: true,
        contributionPeriod: true,
        transactionCategory: { select: { billingKind: true } },
      },
    }),
  ])
  const byUser = new Map<string, ActiveMonthPayment[]>()
  for (const payment of payments) {
    const kind = payment.transactionCategory?.billingKind
    if (kind !== 'MONTHLY' && kind !== 'ANNUAL') continue
    const list = byUser.get(payment.userId) ?? []
    list.push({ amount: payment.amount, billingKind: kind, period: payment.contributionPeriod, paidAt: payment.paidAt })
    byUser.set(payment.userId, list)
  }
  const keys = monthsOfYear(year)
  const rows: ActiveMonthsRow[] = members.map((member) => {
    const { activeMonths } = computeActiveMonths(byUser.get(member.id) ?? [], settings.monthlyFeeKes, settings.annualFeeKes)
    const active = new Set(activeMonths)
    const months = keys.map((key) => active.has(key))
    return {
      userId: member.id,
      fullName: member.fullName,
      membershipNumber: member.membershipNumber,
      standing: member.standing,
      months,
      activeCount: months.filter(Boolean).length,
    }
  })
  return { year, keys, rows, monthlyFeeKes: settings.monthlyFeeKes, annualFeeKes: settings.annualFeeKes }
}
