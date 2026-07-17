import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { actionCreateContribution, actionEmailReceipt } from '@/app/actions/domain'
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
import CsvImportForm from '@/components/dashboard/CsvImportForm'
import MpesaStkForm from '@/components/dashboard/MpesaStkForm'

export const metadata = {
  title: 'Member contributions',
}

export default async function TreasurerContributionsPage() {
  const [data, chart, analytics] = await Promise.all([
    getTreasurerDashboardData(),
    getContributionChartSeries(),
    getContributionAnalytics(),
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-surface p-4">
              <p className="text-xs text-on-surface-variant uppercase">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
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
          <form action={actionCreateContribution} className="grid gap-3 md:grid-cols-2">
            <select name="userId" required className="border rounded-lg px-3 py-2">
              <option value="">Select member</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.email})
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="Amount"
              required
              className="border rounded-lg px-3 py-2"
            />
            <input name="category" placeholder="Category" className="border rounded-lg px-3 py-2" />
            <select name="paymentMethod" className="border rounded-lg px-3 py-2">
              <option value="CASH">CASH</option>
              <option value="MPESA">MPESA</option>
              <option value="BANK">BANK</option>
              <option value="OTHER">OTHER</option>
            </select>
            <input name="mpesaRef" placeholder="M-Pesa ref" className="border rounded-lg px-3 py-2" />
            <input
              name="description"
              placeholder="Description"
              className="border rounded-lg px-3 py-2"
            />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2 md:col-span-2">
              Save contribution
            </button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">CSV import</h2>
          <p className="text-sm text-on-surface-variant mb-2">
            Columns: email, amount, description, category, paymentMethod, mpesaRef
          </p>
          <CsvImportForm />
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
                  <td>{c.paidAt.toLocaleDateString()}</td>
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
