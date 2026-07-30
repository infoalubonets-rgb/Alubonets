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
  ContributionTrendChart,
  PaymentMethodChart,
  TopContributorsChart,
} from '@/components/dashboard/Charts'
import MpesaStkForm from '@/components/dashboard/MpesaStkForm'
import PaymentsModal from '@/components/dashboard/PaymentsModal'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Member contributions',
}

export default async function TreasurerContributionsPage() {
  const [data, chart, analytics, mpesaContributions, failedPayments] = await Promise.all([
    getTreasurerDashboardData(),
    getContributionChartSeries(),
    getContributionAnalytics(),
    prisma.contribution.findMany({
      where: { paymentMethod: 'MPESA', status: { in: ['CONFIRMED','RECONCILED'] } },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { action: 'MPESA_STK_FAILED' },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const catLabels = data.byCategory.map((c) => c.category || 'Uncategorized')
  const catValues = data.byCategory.map((c) => c._sum.amount ?? 0)
  const methodLabels = analytics.byMethod.map((m) => m.method)
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
            <ContributionTrendChart
              labels={chart.labels.length ? chart.labels : ['—']}
              values={chart.values.length ? chart.values : [0]}
            />
          </div>
          <div className="rounded-xl border bg-surface p-4">
            <h2 className="font-semibold mb-3">By category</h2>
            <BudgetDoughnutChart
              labels={catLabels.length ? catLabels : ['None']}
              values={catValues.length ? catValues : [0]}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-surface p-4">
            <h2 className="font-semibold mb-3">Payment methods</h2>
            <PaymentMethodChart
              labels={methodLabels.length ? methodLabels : ['None']}
              values={methodValues.length ? methodValues : [0]}
            />
          </div>
          <div className="rounded-xl border bg-surface p-4 lg:col-span-2">
            <h2 className="font-semibold mb-3">Top contributors</h2>
            <TopContributorsChart
              labels={topLabels.length ? topLabels : ['None']}
              values={topValues.length ? topValues : [0]}
            />
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
          <h2 className="font-semibold mb-3">Recent contributions</h2>
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
              {data.recent.map((c) => (
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
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-2">M-Pesa STK Push</h2>
          <MpesaStkForm />
        </section>
      </div>
    </DashboardShell>
  )
}
