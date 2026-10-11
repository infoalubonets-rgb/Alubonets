import Link from 'next/link'
import { appDayRange } from '@/lib/dates'
import DashboardShell from '@/components/dashboard/DashboardShell'
import AdminFinanceClient from '@/components/admin/AdminFinanceClient'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ContributionTrendChart, ChartEmpty } from '@/components/dashboard/Charts'
import { formatMonthKeys, hasChartData, monthKeyFromDate } from '@/lib/chart-labels'
import { todayInputValue } from '@/lib/dates'
import { withDatabaseRetry } from '@/lib/database-retry'
import { requireAdmin } from '@/lib/auth/session'
import { getStandingSettings } from '@/lib/membership-standing-settings'
import { autoClosePeriods, currentAccountingMonth, monthsWithData, periodAutoClosesAt, periodOpenBlocker } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; month?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  // ?month=YYYY-MM (from the Accounting periods pop-up) filters the page to that month.
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
  const viewYear = monthMatch ? Number(monthMatch[1]) : null
  const viewMonth = monthMatch ? Number(monthMatch[2]) : null
  if (viewYear && viewMonth && !sp.from && !sp.to) {
    sp.from = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toISOString().slice(0, 10)
    sp.to = new Date(Date.UTC(viewYear, viewMonth, 0)).toISOString().slice(0, 10)
  }
  // Whole days in Nairobi time; payments made any time on the "to" day count.
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? appDayRange(sp.from).start : undefined
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? appDayRange(sp.to).end : undefined

  const contributionWhere: Prisma.ContributionWhereInput = {
    status: { in: ['CONFIRMED', 'RECONCILED'] },
    ...(from || to
      ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  }

  const current = currentAccountingMonth()
  const currentYear = current.year
  const currentMonth = current.month

  await withDatabaseRetry(() => autoClosePeriods()).catch(() => {})

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
    standingSettings,
    afterCloseEntries,
    dataMonths,
    viewDataMonths,
  ] = await withDatabaseRetry(() => Promise.all([
    prisma.transactionCategory.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true, code: true, active: true, billingKind: true } }),
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
    getStandingSettings(),
    viewYear && viewMonth
      ? prisma.financialTransaction.findMany({
          where: { period: { year: viewYear, month: viewMonth }, OR: [{ addedAfterClose: true }, { editedAfterClose: true }] },
          select: { id: true, transactionNumber: true, type: true, status: true, amount: true, description: true, occurredAt: true, addedAfterClose: true, editedAfterClose: true, createdBy: { select: { fullName: true } } },
          orderBy: { occurredAt: 'asc' },
        })
      : Promise.resolve([]),
    monthsWithData(currentYear),
    viewYear && viewYear !== currentYear ? monthsWithData(viewYear) : Promise.resolve(null),
  ]))
  const viewHasData = viewYear && viewMonth ? (viewDataMonths ?? dataMonths).has(viewMonth) : true
  const periodByMonth = new Map(periods.map((period) => [period.month, period]))

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
          standingSettings={{
            monthlyFeeKes: standingSettings.monthlyFeeKes,
            monthlyGraceDays: standingSettings.monthlyGraceDays,
            annualFeeKes: standingSettings.annualFeeKes,
            annualRenewalDays: standingSettings.annualRenewalDays,
            annualDueDate: standingSettings.annualDueDate,
            effectiveFrom: standingSettings.effectiveFrom.toISOString().slice(0, 10),
          }}
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
          periods={Array.from({ length: 12 }, (_, index) => {
            const month = index + 1
            const target = { year: currentYear, month }
            return {
              key: `${currentYear}-${String(month).padStart(2, '0')}`,
              month,
              year: currentYear,
              monthLabel: new Date(Date.UTC(currentYear, index, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' }),
              status: periodByMonth.get(month)?.status ?? 'CLOSED',
              closesOn: periodAutoClosesAt(currentYear, month).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
              hasData: dataMonths.has(month),
              canOpen: !periodOpenBlocker(target, current, dataMonths.has(month)),
            }
          })}
          currentMonth={currentMonth}
          today={todayInputValue()}
        />

        {viewYear && viewMonth && (
          <section className="rounded-2xl border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-h3 text-lg text-primary">
                {new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </h2>
              <span className="flex gap-4 text-sm font-semibold text-primary">
                <Link href={`/dashboard/treasurer/ledger?month=${sp.month}`}>Ledger for this month</Link>
                <Link href="/admin/finance">Back to all months</Link>
              </span>
            </div>
            {!viewHasData && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">event_busy</span>
                No data for this month. All totals below are 0.
              </p>
            )}
            <h3 className="mt-4 text-sm font-semibold text-on-surface">Changed after the month closed ({afterCloseEntries.length})</h3>
            {afterCloseEntries.length === 0 ? (
              <p className="mt-1 text-sm text-on-surface-variant">None.</p>
            ) : (
              <ul className="mt-2 divide-y rounded-xl border">
                {afterCloseEntries.map((tx) => (
                  <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <b>{tx.transactionNumber}</b> · {tx.description} · KES {Number(tx.amount).toLocaleString()}
                      <span className="block text-xs text-on-surface-variant">{tx.occurredAt.toLocaleDateString('en-KE')} · {tx.type.toLowerCase()} · {tx.status.toLowerCase()} · by {tx.createdBy.fullName}</span>
                    </span>
                    <span className="flex gap-1">
                      {tx.addedAfterClose && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Added after close</span>}
                      {tx.editedAfterClose && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">Edited after close</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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

          {/* Phones: one compact row per member. */}
          <ul className="mt-4 divide-y divide-outline-variant/60 rounded-xl border md:hidden">
            {memberRows.length === 0 ? (
              <li className="p-6 text-center text-sm text-on-surface-variant">No members found.</li>
            ) : (
              memberRows.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.fullName}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {m.count} payment{m.count === 1 ? '' : 's'} · last {m.last ? new Date(m.last).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">KES {m.total.toLocaleString()}</p>
                </li>
              ))
            )}
          </ul>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border md:block">
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
