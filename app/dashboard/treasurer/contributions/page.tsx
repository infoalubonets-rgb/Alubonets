import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { actionEmailReceipt } from '@/app/actions/domain'
import Link from 'next/link'
import {
  getTreasurerDashboardData,
  getContributionChartSeries,
  getContributionAnalytics,
} from '@/lib/data/queries'
import {
  BudgetDoughnutChart,
  ChartEmpty,
  ContributionTrendChart,
  PaymentMethodChart,
  TopContributorsChart,
} from '@/components/dashboard/Charts'
import { hasChartData } from '@/lib/chart-labels'
import MpesaStkForm from '@/components/dashboard/MpesaStkForm'
import PaymentsModal from '@/components/dashboard/PaymentsModal'
import PaginationBar from '@/components/ui/PaginationBar'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Member contributions',
}

export default async function TreasurerContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = parsePage(sp.page)
  const pageSize = 25
  const q = (sp.q || '').trim()
  const contributionWhere = {
    status: { in: ['CONFIRMED', 'RECONCILED'] as const },
    ...(q
      ? {
          OR: [
            { user: { fullName: { contains: q, mode: 'insensitive' as const } } },
            { user: { email: { contains: q, mode: 'insensitive' as const } } },
            { mpesaRef: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [data, chart, analytics, mpesaContributions, failedPayments, contribTotal, recent] =
    await Promise.all([
      getTreasurerDashboardData(),
      getContributionChartSeries(),
      getContributionAnalytics(),
      prisma.contribution.findMany({
        where: { paymentMethod: 'MPESA', status: { in: ['CONFIRMED', 'RECONCILED'] } },
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),
      prisma.auditLog.findMany({
        where: { action: 'MPESA_STK_FAILED' },
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.contribution.count({ where: contributionWhere }),
      prisma.contribution.findMany({
        where: contributionWhere,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { paidAt: 'desc' },
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
    ])

  const catLabels = data.byCategory.map((c) => c.category || 'Uncategorized')
  const catValues = data.byCategory.map((c) => c._sum.amount ?? 0)
  const methodLabels = analytics.byMethod.map((m) => m.label)
  const methodValues = analytics.byMethod.map((m) => m.total)
  const topLabels = analytics.topContributors.map((t) => t.name)
  const topValues = analytics.topContributors.map((t) => t.total)

  const stats = [
    { label: 'Total collected (KES)', value: Math.round(data.total).toLocaleString() },
    { label: 'This month (KES)', value: Math.round(data.monthTotal).toLocaleString() },
    { label: 'Records', value: data.count.toLocaleString() },
    { label: 'Contributing members', value: analytics.contributorCount.toLocaleString() },
  ]

  return (
    <DashboardShell role="TREASURER" title="Member contributions" nav={TREASURER_NAV}>
      <div className="space-y-6 p-4 md:p-6">

        {/* Header row with Payments button */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border bg-surface p-4">
                <p className="text-xs text-on-surface-variant uppercase">{s.label}</p>
                <p className="text-2xl font-semibold mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payments modal trigger */}
        <div className="flex items-center gap-3">
          <PaymentsModal
            successPayments={mpesaContributions.map((p) => ({
              id: p.id,
              amount: p.amount,
              paidAt: p.paidAt.toISOString(),
              mpesaRef: p.mpesaRef,
              user: p.user,
            }))}
            failedPayments={failedPayments.map((f) => ({
              id: f.id,
              createdAt: f.createdAt.toISOString(),
              meta: (f.meta ?? {}) as Prisma.JsonObject,
              user: f.user,
            }))}
          />
          <p className="text-[12px] text-on-surface-variant">
            {mpesaContributions.length} M-Pesa payment{mpesaContributions.length !== 1 ? 's' : ''} recorded
            {failedPayments.length > 0 && ` · ${failedPayments.length} failed`}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-surface p-4 lg:col-span-2">
            <h2 className="font-semibold mb-3">Monthly contribution trend</h2>
            {hasChartData(chart.values) ? (
              <ContributionTrendChart labels={chart.labels} values={chart.values} />
            ) : (
              <ChartEmpty message="No confirmed contributions recorded yet." />
            )}
          </div>
          <div className="rounded-xl border bg-surface p-4">
            <h2 className="font-semibold mb-3">By category</h2>
            {hasChartData(catValues) ? (
              <BudgetDoughnutChart labels={catLabels} values={catValues} />
            ) : (
              <ChartEmpty message="No contributions by category yet." />
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-surface p-4">
            <h2 className="font-semibold mb-3">Payment methods</h2>
            {hasChartData(methodValues) ? (
              <PaymentMethodChart labels={methodLabels} values={methodValues} />
            ) : (
              <ChartEmpty message="No payment method data yet." />
            )}
          </div>
          <div className="rounded-xl border bg-surface p-4 lg:col-span-2">
            <h2 className="font-semibold mb-3">Top contributors</h2>
            {hasChartData(topValues) ? (
              <TopContributorsChart labels={topLabels} values={topValues} />
            ) : (
              <ChartEmpty message="No contributor data yet." />
            )}
          </div>
        </div>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Record contribution</h2>
          <p className="text-sm text-on-surface-variant">All new contributions must be recorded through the immutable financial ledger.</p>
          <Link href="/dashboard/treasurer/ledger" className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-on-primary">Open ledger entry</Link>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">CSV import</h2>
          <p className="text-sm text-on-surface-variant mb-2">
            Legacy direct CSV import is disabled because every movement must produce balanced ledger entries. Use the ledger entry screen.
          </p>
        </section>

        <section className="rounded-xl border bg-surface p-4 overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Recent contributions</h2>
            <form method="get" className="flex gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search member or ref"
                className="rounded-lg border px-3 py-1.5 text-sm"
              />
              <button className="rounded-lg border px-3 py-1.5 text-sm">Search</button>
            </form>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">Member</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Ref</th>
                <th>Date</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{c.user.fullName}</td>
                  <td>{c.amount.toLocaleString()}</td>
                  <td>{c.paymentMethod}</td>
                  <td>{c.mpesaRef || '—'}</td>
                  <td>{new Date(c.paidAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <a className="text-primary underline" href={`/api/pdf/receipt/${c.id}`}>
                        PDF
                      </a>
                      <form action={actionEmailReceipt}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-primary underline" title="Email receipt PDF to member">
                          Email
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            pathname="/dashboard/treasurer/contributions"
            page={page}
            totalPages={totalPages(contribTotal, pageSize)}
            params={{ q }}
          />
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-2">M-Pesa STK Push</h2>
          <MpesaStkForm />
        </section>
      </div>
    </DashboardShell>
  )
}
