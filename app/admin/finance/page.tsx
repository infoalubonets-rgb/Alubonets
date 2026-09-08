import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import AdminFinanceClient from '@/components/admin/AdminFinanceClient'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ContributionTrendChart, ChartEmpty } from '@/components/dashboard/Charts'
import { formatMonthKeys, hasChartData, monthKeyFromDate } from '@/lib/chart-labels'
import { todayInputValue } from '@/lib/dates'
import { withDatabaseRetry } from '@/lib/database-retry'

export const dynamic = 'force-dynamic'

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const from = sp.from ? new Date(sp.from) : undefined
  const to = sp.to ? new Date(sp.to) : undefined

  const contributionWhere: Prisma.ContributionWhereInput = {
    status: { in: ['CONFIRMED', 'RECONCILED'] },
    ...(from || to
      ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  }

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [
    categories,
    pending,
    periods,
    setting,
    loanLimitSetting,
    totalAgg,
    monthlyRows,
    byUser,
    members,
  ] = await withDatabaseRetry(() => Promise.all([
    prisma.transactionCategory.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true, code: true, active: true } }),
    prisma.financialTransaction.findMany({
      where: { status: 'PENDING' },
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.accountingPeriod.findMany({ where: { year: currentYear }, orderBy: { month: 'asc' } }),
    prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }),
    prisma.appSetting.findUnique({ where: { key: 'loan_max_amount_kes' } }),
    prisma.contribution.aggregate({ where: contributionWhere, _sum: { amount: true }, _count: true }),
    prisma.contribution.findMany({ where: contributionWhere, select: { amount: true, paidAt: true }, orderBy: { paidAt: 'asc' } }),
    prisma.contribution.groupBy({ by: ['userId'], where: contributionWhere, _sum: { amount: true }, _count: true, _max: { paidAt: true } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, fullName: true, email: true }, orderBy: { fullName: 'asc' } }),
  ]))

  const monthlyMap = new Map<string, number>()
  for (const row of monthlyRows) {
    const key = monthKeyFromDate(row.paidAt)
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + row.amount)
  }
  const chartKeys = [...monthlyMap.keys()]
  const chartLabels = formatMonthKeys(chartKeys)
  const chartValues = chartKeys.map((k) => monthlyMap.get(k) ?? 0)

  const byUserMap = new Map(byUser.map((u) => [u.userId, u]))
  const memberRows = members
    .map((m) => {
      const agg = byUserMap.get(m.id)
      return {
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        count: agg?._count ?? 0,
        total: agg?._sum.amount ?? 0,
        last: agg?._max.paidAt ?? null,
      }
    })
    .sort((a, b) => b.total - a.total)

  const totalContributed = totalAgg._sum.amount ?? 0
  const contributingMembers = byUser.length
  const money = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

  const stats = [
    { label: 'Total contributed', value: money.format(totalContributed) },
    { label: 'Recorded payments', value: totalAgg._count.toLocaleString() },
    { label: 'Contributing members', value: contributingMembers.toLocaleString() },
    { label: 'Not yet contributed', value: (members.length - contributingMembers).toLocaleString() },
  ]

  return (
    <DashboardShell role="ADMIN" title="Finance administration" nav={ADMIN_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <AdminFinanceClient
          approvalThreshold={setting?.value || '50000'}
          loanApplicationLimit={loanLimitSetting?.value || '50000'}
          categories={categories}
          pending={pending.map((tx) => ({
            id: tx.id,
            transactionNumber: tx.transactionNumber,
            type: tx.type,
            amount: Number(tx.amount),
            description: tx.description,
            correctionReason: tx.correctionReason,
            createdByName: tx.createdBy.fullName,
          }))}
          periods={periods.map((period) => ({
            id: period.id,
            month: period.month,
            monthLabel: new Date(period.startsAt).toLocaleString('en', { month: 'long' }),
            status: period.status,
          }))}
          currentMonth={currentMonth}
          currentYear={currentYear}
          today={todayInputValue()}
        />

        <section className="rounded-2xl border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-h3 text-lg text-primary">Member payment summary</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Totals from confirmed member contributions — not the full ledger.</p>
            </div>
            <form method="get" className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-bold text-on-surface-variant">
                From
                <input type="date" name="from" defaultValue={sp.from || ''} className="mt-1 block h-9 rounded-lg border px-3 text-sm" />
              </label>
              <label className="text-xs font-bold text-on-surface-variant">
                To
                <input type="date" name="to" defaultValue={sp.to || ''} className="mt-1 block h-9 rounded-lg border px-3 text-sm" />
              </label>
              <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm text-on-primary">Filter</button>
              {(sp.from || sp.to) && (
                <Link href="/admin/finance" className="inline-flex h-9 items-center rounded-lg border px-4 text-sm">Reset</Link>
              )}
            </form>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border bg-surface-container-low p-4">
                <p className="text-xs uppercase text-on-surface-variant">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border bg-surface-container-low p-4">
            <h3 className="mb-3 text-sm font-semibold text-on-surface-variant">Monthly trend</h3>
            {hasChartData(chartValues) ? (
              <ContributionTrendChart labels={chartLabels} values={chartValues} />
            ) : (
              <ChartEmpty message="No contributions in the selected period." />
            )}
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface-container-low text-left text-xs uppercase text-on-surface-variant">
                  <th className="p-3">Member</th>
                  <th className="p-3">Payments</th>
                  <th className="p-3">Total (KES)</th>
                  <th className="p-3">Last contribution</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-on-surface-variant">No members found.</td>
                  </tr>
                ) : (
                  memberRows.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{m.fullName}</p>
                        <p className="text-xs text-on-surface-variant">{m.email}</p>
                      </td>
                      <td className="p-3">{m.count}</td>
                      <td className="p-3">{m.total.toLocaleString()}</td>
                      <td className="p-3">{m.last ? new Date(m.last).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
