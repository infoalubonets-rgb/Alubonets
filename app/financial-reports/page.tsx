import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { accountBalances } from '@/lib/finance'
import { ChartEmpty, IncomeExpenseChart } from '@/components/dashboard/Charts'
import { formatMonthKeys, hasChartData, monthKeyFromDate } from '@/lib/chart-labels'
import type { Prisma } from '@prisma/client'

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string }>
}) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN', 'EXECUTIVE'])
  const filters = await searchParams
  const from = filters.from ? new Date(filters.from) : new Date('2026-01-01')
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`) : new Date('2026-12-31T23:59:59.999')
  const where: Prisma.FinancialTransactionWhereInput = {
    occurredAt: { gte: from, lte: to },
    status: { in: ['CONFIRMED', 'RECONCILED'] },
    ...(filters.category ? { categoryId: filters.category } : {}),
  }

  const [transactions, categories, balances, obligations, reconciliations] = await Promise.all([
    prisma.financialTransaction.findMany({ where, include: { category: true }, orderBy: { occurredAt: 'desc' } }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    accountBalances(),
    prisma.memberContributionObligation.findMany({
      where: { status: { in: ['OUTSTANDING', 'PARTIALLY_PAID'] } },
      include: {
        user: true,
        campaign: { include: { contributions: { where: { status: { in: ['CONFIRMED', 'RECONCILED'] } } } } },
      },
    }),
    prisma.reconciliation.count({ where: { reconciledAt: { gte: from, lte: to } } }),
  ])

  const income = transactions
    .filter((t) => t.type === 'CONTRIBUTION')
    .reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions
    .filter((t) => ['EXPENSE', 'DISBURSEMENT'].includes(t.type))
    .reduce((s, t) => s + Number(t.amount), 0)

  const monthlyMap = new Map<string, { income: number; expense: number }>()
  for (const tx of transactions) {
    const key = monthKeyFromDate(tx.occurredAt)
    const entry = monthlyMap.get(key) ?? { income: 0, expense: 0 }
    if (tx.type === 'CONTRIBUTION') entry.income += Number(tx.amount)
    else if (['EXPENSE', 'DISBURSEMENT'].includes(tx.type)) entry.expense += Number(tx.amount)
    monthlyMap.set(key, entry)
  }
  const chartKeys = [...monthlyMap.keys()].sort()
  const chartLabels = formatMonthKeys(chartKeys)
  const chartIncome = chartKeys.map((k) => monthlyMap.get(k)?.income ?? 0)
  const chartExpense = chartKeys.map((k) => monthlyMap.get(k)?.expense ?? 0)
  const hasMonthlyData = hasChartData(chartIncome) || hasChartData(chartExpense)

  return (
    <DashboardShell role={actor.role} title="Financial reports" nav={navForRole(actor.role)}>
      <div className="space-y-6 p-4 md:p-6">
        <form className="flex flex-wrap items-end gap-2 rounded-xl border bg-surface p-4">
          <label>
            From
            <input name="from" type="date" defaultValue={from.toISOString().slice(0, 10)} className="block rounded-lg border px-3 py-2" />
          </label>
          <label>
            To
            <input name="to" type="date" defaultValue={to.toISOString().slice(0, 10)} className="block rounded-lg border px-3 py-2" />
          </label>
          <select name="category" defaultValue={filters.category || ''} className="rounded-lg border px-3 py-2">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-primary px-4 py-2 text-on-primary">Apply</button>
          <a
            href={`/api/export/financial?from=${from.toISOString()}&to=${to.toISOString()}${filters.category ? `&category=${filters.category}` : ''}`}
            className="rounded-full border px-4 py-2"
          >
            Export CSV
          </a>
        </form>

        <section className="grid gap-3 md:grid-cols-3">
          <Card title="Income" value={income} />
          <Card title="Expenditure" value={expenses} />
          <Card title="Net movement" value={income - expenses} />
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl">Monthly income vs expenditure</h2>
          <p className="mt-1 text-sm text-on-surface-variant">From confirmed ledger transactions in the selected period.</p>
          <div className="mt-4">
            {hasMonthlyData ? (
              <IncomeExpenseChart labels={chartLabels} income={chartIncome} expense={chartExpense} />
            ) : (
              <ChartEmpty message="No confirmed transactions in the selected period." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl">Cash, bank and M-Pesa balances</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {balances.filter((a) => a.type === 'ASSET').map((a) => (
              <Card key={a.id} title={a.name} value={a.balance} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl">Arrears</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Campaign</th>
                  <th>Target</th>
                  <th>Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {obligations.map((o) => {
                  const paid = o.campaign.contributions
                    .filter((c) => c.userId === o.userId)
                    .reduce((s, c) => s + c.amount, 0)
                  return (
                    <tr key={o.id}>
                      <td>{o.user.fullName}</td>
                      <td>{o.campaign.title}</td>
                      <td>{Number(o.targetAmount).toLocaleString()}</td>
                      <td>{paid.toLocaleString()}</td>
                      <td>{Math.max(0, Number(o.targetAmount) - paid).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl">Income and expenditure</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.occurredAt.toLocaleDateString()}</td>
                    <td>{t.transactionNumber}</td>
                    <td>{t.type}</td>
                    <td>{t.category?.name || '—'}</td>
                    <td>{t.description}</td>
                    <td>{Number(t.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">{reconciliations} reconciliation(s) in the selected period.</p>
        </section>
      </div>
    </DashboardShell>
  )
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <p className="text-xs uppercase">{title}</p>
      <b>KES {value.toLocaleString()}</b>
    </div>
  )
}
