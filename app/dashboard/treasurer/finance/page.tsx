import ScrollToolbar from '@/components/ui/ScrollToolbar'
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
import { IncomeExpenseChart, BudgetDoughnutChart, ContributionTrendChart, ApprovalStatusChart, ChartEmpty } from '@/components/dashboard/Charts'
import AddContributionButton from '@/components/finance/AddContributionButton'
import ContributionRecordsSection, { type ContributionRecordsParams } from '@/components/finance/ContributionRecordsSection'
import { canRecordPayments } from '@/lib/finance-access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Financial overview' }
const kes = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`

/** Finance: the overview figures and charts plus contribution records, on one page. */
export default async function FinancialOverview({ searchParams }: { searchParams: Promise<ContributionRecordsParams> }) {
  const actor = await requireActiveRole(['TREASURER'])
  const sp = await searchParams
  const canRecord = canRecordPayments(actor)
  const [flags, transactions, loans, welfare] = await Promise.all([
    getFeatureFlags(),
    prisma.financialTransaction.findMany({ orderBy: { occurredAt: 'desc' }, select: { id: true, transactionNumber: true, type: true, status: true, amount: true, categoryId: true, category: { select: { name: true } }, occurredAt: true, description: true } }),
    prisma.loanApplication.groupBy({ by: ['status'], _count: true }),
    prisma.welfareRequest.groupBy({ by: ['status'], _count: true }),
  ])
  const totals = summariseFinance(transactions)
  const confirmed = transactions.filter(t => ['CONFIRMED', 'RECONCILED'].includes(t.status))
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const series = months.map(month => summariseFinance(confirmed.filter(t => t.occurredAt.toISOString().startsWith(month))))
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
  return <DashboardShell role="TREASURER" title="Financial overview" nav={TREASURER_NAV} pageAction={<AddContributionButton />}>
    <div className="space-y-6">

            <ScrollToolbar label="Finance records"><nav aria-label="Finance records" className="flex min-w-full items-center justify-end gap-2">
        <RelatedPageLinks items={links.map(([label, href]) => ({ label, href, icon: ({ 'Contribution records': 'receipt_long', 'Member contributions': 'groups', 'Financial ledger': 'account_balance_wallet', 'Financial reports': 'bar_chart', 'Transaction history': 'history', Loans: 'request_quote', 'Welfare requests': 'volunteer_activism' } as Record<string, string>)[label] || 'payments' }))} />
        <IconModalButton icon="volunteer_activism" label="Loans & welfare" title="Loan and welfare history" size="xl" showText variant="primary"><FinancialRequestsHistory /></IconModalButton>
      </nav></ScrollToolbar>
      {/* KPI cards: overview figures and contribution figures together. */}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {[
        ['Money received', kes(totals.income)], ['Money paid out', kes(totals.outgoing)], ['Net movement', kes(totals.net)], ['Awaiting confirmation', pending.toLocaleString()],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-outline-variant p-5"><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
        <ContributionRecordsSection sp={sp} canRecord={canRecord} part="kpis" />
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
        <ContributionRecordsSection sp={sp} canRecord={canRecord} part="charts" />
      </div>

      <section className="rounded-2xl border border-outline-variant p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Latest financial activity</h2><Link className="text-primary underline" href="/dashboard/treasurer/ledger">View ledger</Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Date', 'Reference', 'Description', 'Status', 'Amount'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{transactions.slice(0, 10).map(t => <tr key={t.id} className="border-t border-outline-variant"><td className="p-3">{t.occurredAt.toLocaleDateString('en-KE')}</td><td className="p-3">{t.transactionNumber}</td><td className="p-3">{t.description}</td><td className="p-3">{t.status}</td><td className="p-3">{kes(Number(t.amount))}</td></tr>)}</tbody></table>{!transactions.length && <p className="p-3">No financial activity yet.</p>}</div></section>

      <h2 className="pt-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Contributions</h2>
      <ContributionRecordsSection sp={sp} canRecord={canRecord} part="records" />
    </div>
  </DashboardShell>
}




