import DashboardShell, { type NavItem } from '@/components/dashboard/DashboardShell'
import {
  actionCreateContribution,
  actionReviewWelfare,
} from '@/app/actions/domain'
import { getTreasurerDashboardData, getContributionChartSeries } from '@/lib/data/queries'
import { BudgetDoughnutChart, ContributionTrendChart } from '@/components/dashboard/Charts'
import CsvImportForm from '@/components/dashboard/CsvImportForm'
import MpesaStkForm from '@/components/dashboard/MpesaStkForm'

const NAV: NavItem[] = [
  { icon: 'account_balance', label: 'Finance', active: true },
  { icon: 'payments', label: 'Contributions' },
  { icon: 'volunteer_activism', label: 'Welfare' },
]

export default async function TreasurerPage() {
  const data = await getTreasurerDashboardData()
  const chart = await getContributionChartSeries()
  const catLabels = data.byCategory.map((c) => c.category || 'Uncategorized')
  const catValues = data.byCategory.map((c) => c._sum.amount ?? 0)

  return (
    <DashboardShell role="TREASURER" title="Treasurer Finance" nav={NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Total (KES)', value: Math.round(data.total).toLocaleString() },
            { label: 'This month', value: Math.round(data.monthTotal).toLocaleString() },
            { label: 'Records', value: data.count },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-surface p-4">
              <p className="text-xs text-on-surface-variant uppercase">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-surface p-4">
            <h2 className="font-semibold mb-3">Trend</h2>
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
                    <a className="text-primary underline" href={`/api/pdf/receipt/${c.id}`}>
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border bg-surface p-4 space-y-3">
          <h2 className="font-semibold">Welfare reviews</h2>
          {data.pendingWelfare.length === 0 && (
            <p className="text-sm text-on-surface-variant">No pending welfare requests.</p>
          )}
          {data.pendingWelfare.map((w) => (
            <div key={w.id} className="border rounded-lg p-3">
              <p className="font-medium">
                {w.user.fullName} — {w.description}
              </p>
              <p className="text-sm text-on-surface-variant">
                Amount: {w.amount?.toLocaleString() ?? '—'}
              </p>
              <div className="flex gap-2 mt-2">
                {(['APPROVED', 'REJECTED', 'PAID'] as const).map((status) => (
                  <form key={status} action={actionReviewWelfare}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="status" value={status} />
                    <button className="px-3 py-1.5 border rounded-lg text-xs">{status}</button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-2">M-Pesa STK Push</h2>
          <MpesaStkForm />
        </section>
      </div>
    </DashboardShell>
  )
}
