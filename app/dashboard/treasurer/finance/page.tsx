import IconModalButton from '@/components/ui/IconModalButton'
import FinancialRequestsHistory from '@/components/finance/FinancialRequestsHistory'
import RelatedPageLinks from '@/components/dashboard/RelatedPageLinks'
import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { FEATURE_FLAGS, getFeatureFlags } from '@/lib/feature-flags'
import { summariseFinance } from '@/lib/finance-overview'
import { monthKeyFromDate } from '@/lib/chart-labels'
import { IncomeExpenseChart, BudgetDoughnutChart, ContributionTrendChart, ApprovalStatusChart, ChartEmpty } from '@/components/dashboard/Charts'
import AddContributionButton from '@/components/finance/AddContributionButton'
import ContributionRecordsSection from '@/components/finance/ContributionRecordsSection'
import { canRecordPayments } from '@/lib/finance-access'
import FinanceTransactionsTable from '@/components/finance/FinanceTransactionsTable'
import PaginationBar from '@/components/ui/PaginationBar'
import { FINANCE_TX_PAGE_SIZE, getFinanceTransactions } from '@/lib/finance-transactions'
import { totalPages } from '@/lib/pagination'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Financial overview' }
const kes = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`

/** Finance: the overview figures and charts plus contribution records, on one page. */
export default async function FinancialOverview({ searchParams }: { searchParams: Promise<{ q?: string; year?: string; status?: string; page?: string }> }) {
  const actor = await requireActiveRole(['TREASURER'])
  const sp = await searchParams
  const canRecord = canRecordPayments(actor)
  const [txTable, flags, transactions, loans, welfare] = await Promise.all([
    getFinanceTransactions({ q: sp.q, year: sp.year, status: sp.status, page: Number(sp.page) || 1 }),
    getFeatureFlags(),
    prisma.financialTransaction.findMany({ orderBy: { occurredAt: 'desc' }, select: { id: true, transactionNumber: true, type: true, status: true, amount: true, categoryId: true, category: { select: { name: true } }, occurredAt: true, description: true } }),
    prisma.loanApplication.groupBy({ by: ['status'], _count: true }),
    prisma.welfareRequest.groupBy({ by: ['status'], _count: true }),
  ])
  const totals = summariseFinance(transactions)
  const confirmed = transactions.filter(t => ['CONFIRMED', 'RECONCILED'].includes(t.status))
  const [year, month] = monthKeyFromDate(new Date()).split('-').map(Number)
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 12 + i, 1, 12))
    return monthKeyFromDate(d)
  })
  const series = months.map(month => summariseFinance(confirmed.filter(t => monthKeyFromDate(t.occurredAt) === month)))
  const categorySeries = (types: string[]) => {
    const sums = new Map<string, number>()
    for (const t of confirmed.filter(t => types.includes(t.type))) {
      const label = t.category?.name || 'Uncategorised'
      sums.set(label, (sums.get(label) || 0) + Number(t.amount))
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1])
  }
  const incomeCategories = categorySeries(['CONTRIBUTION'])
  const outgoingCategories = categorySeries(['EXPENSE', 'DISBURSEMENT'])
  const statuses = [...new Set(transactions.map(t => t.status))]
  const monthLabels = months.map(month => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }))
  const pending = transactions.filter(t => t.status === 'PENDING').length
  const links = [
    ['Transaction history', '/dashboard/treasurer/ledger?history=1'],
    ...(flags[FEATURE_FLAGS.loansEnabled] ? [['Loans', '/dashboard/treasurer/loans']] : []),
    ...(flags[FEATURE_FLAGS.welfareEnabled] ? [['Welfare requests', '/dashboard/treasurer/welfare']] : []),
  ]
  return <DashboardShell role="TREASURER" title="Financial overview" nav={TREASURER_NAV} pageAction={<div className="flex items-center gap-2"><AddContributionButton /><ContributionRecordsSection canRecord={canRecord} part="mpesa" /></div>} pageSecondRow={<div className="flex items-center gap-2"><RelatedPageLinks items={links.map(([label, href]) => ({ label, href, icon: ({ 'Contribution records': 'receipt_long', 'Member contributions': 'groups', 'Financial ledger': 'account_balance_wallet', 'Financial reports': 'bar_chart', 'Transaction history': 'history', Loans: 'request_quote', 'Welfare requests': 'volunteer_activism' } as Record<string, string>)[label] || 'payments' }))} />         <IconModalButton icon="volunteer_activism" label="Loans & welfare" title="Loan and welfare history" size="xl" showText variant="primary"><FinancialRequestsHistory /></IconModalButton></div>}>
    <div className="space-y-6">


      {/* KPI cards: overview figures and contribution figures together. */}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {[
        ['Money received', kes(totals.income)], ['Money paid out', kes(totals.outgoing)], ['Net movement', kes(totals.net)], ['Awaiting confirmation', pending.toLocaleString()],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-outline-variant p-5"><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
        <ContributionRecordsSection canRecord={canRecord} part="kpis" />
      </div>

      {/* Every chart on the page, directly under the KPI cards. */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      
        <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Money in and out · last 12 months</h2>{confirmed.length ? <IncomeExpenseChart labels={monthLabels} income={series.map(s => s.income)} expense={series.map(s => s.outgoing)} /> : <ChartEmpty />}</section>
        <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Loan and welfare payments · all time</h2>{totals.loanDisbursed + totals.loanRepaid + totals.welfarePaid > 0 ? <BudgetDoughnutChart labels={['Loans disbursed', 'Loan repayments', 'Welfare paid']} values={[totals.loanDisbursed, totals.loanRepaid, totals.welfarePaid]} /> : <ChartEmpty />}</section>
      
        <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Monthly net movement · KES</h2>{series.some(s => s.income || s.outgoing) ? <ContributionTrendChart labels={monthLabels} values={series.map(s => s.net)} /> : <ChartEmpty />}</section>
        <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Money received by purpose · KES</h2>{incomeCategories.length ? <BudgetDoughnutChart labels={incomeCategories.map(([label]) => label)} values={incomeCategories.map(([, amount]) => amount)} /> : <ChartEmpty />}</section>
        <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Spending by purpose · KES</h2>{outgoingCategories.length ? <BudgetDoughnutChart labels={outgoingCategories.map(([label]) => label)} values={outgoingCategories.map(([, amount]) => amount)} /> : <ChartEmpty />}</section>
        <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Transaction status · records</h2>{statuses.length ? <ApprovalStatusChart labels={statuses.map(s => s.replaceAll('_', ' '))} values={statuses.map(status => transactions.filter(t => t.status === status).length)} /> : <ChartEmpty />}</section>
        {flags[FEATURE_FLAGS.loansEnabled] && <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Loan request status · requests</h2>{loans.length ? <ApprovalStatusChart labels={loans.map(r => r.status.replaceAll('_', ' '))} values={loans.map(r => r._count)} /> : <ChartEmpty />}</section>}
        {flags[FEATURE_FLAGS.welfareEnabled] && <section className="rounded-2xl border border-outline-variant p-5"><h2 className="mb-4 text-lg font-semibold">Welfare request status · requests</h2>{welfare.length ? <ApprovalStatusChart labels={welfare.map(r => r.status.replaceAll('_', ' '))} values={welfare.map(r => r._count)} /> : <ChartEmpty />}</section>}
        <ContributionRecordsSection canRecord={canRecord} part="charts" />
      </div>

      <section id="transactions" className="rounded-2xl border border-outline-variant p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Transactions <span className="text-sm font-normal text-on-surface-variant">· {txTable.total.toLocaleString()}</span></h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <a className="rounded-full border border-outline-variant px-3 py-1.5 font-semibold text-primary" href={`/api/export/financial?from=${txTable.year || '2000'}-01-01&to=${txTable.year || new Date().getFullYear()}-12-31`}>Export CSV</a>
            <a className="rounded-full border border-outline-variant px-3 py-1.5 font-semibold text-primary" href={`/api/export/financial-xlsx?from=${txTable.year || '2000'}-01-01&to=${txTable.year || new Date().getFullYear()}-12-31`}>Export Excel</a>
            <Link className="rounded-full border border-outline-variant px-3 py-1.5 font-semibold text-primary" href="/dashboard/treasurer/ledger">View ledger</Link>
          </div>
        </div>
        <form method="get" action="/dashboard/treasurer/finance#transactions" className="mb-3 flex flex-wrap gap-2">
          <input name="q" defaultValue={txTable.q} placeholder="Search name, email or reference" className="h-10 min-w-[220px] flex-1 rounded-xl border px-3 text-sm" />
          <select name="year" defaultValue={txTable.year} className="h-10 rounded-xl border px-3 text-sm">
            <option value="">All years</option>
            {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="status" defaultValue={txTable.status} className="h-10 rounded-xl border px-3 text-sm">
            <option value="">All statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="PENDING">Pending</option>
            <option value="REVERSED">Reversed</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Filter</button>
        </form>
        <FinanceTransactionsTable rows={txTable.rows} />
        <PaginationBar pathname="/dashboard/treasurer/finance" page={txTable.page} totalPages={totalPages(txTable.total, FINANCE_TX_PAGE_SIZE)} params={{ q: txTable.q, year: txTable.year, status: txTable.status }} />
      </section>

      <h2 className="pt-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Contributions</h2>
      <ContributionRecordsSection canRecord={canRecord} part="records" />
    </div>
  </DashboardShell>
}




