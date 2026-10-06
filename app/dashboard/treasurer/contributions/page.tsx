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
import PaymentsModal from '@/components/dashboard/PaymentsModal'
import PendingContributionVerify from '@/components/dashboard/PendingContributionVerify'
import PaginationBar from '@/components/ui/PaginationBar'
import ReconcilePaymentButton from '@/components/finance/ReconcilePaymentButton'
import UnmatchedPayments from '@/components/finance/UnmatchedPayments'
import { filterSelectableCategories } from '@/lib/payment-categories'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { canRecordPayments } from '@/lib/finance-access'
import type { Prisma, TransactionStatus } from '@prisma/client'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Member contributions',
}

export default async function TreasurerContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; year?: string; purpose?: string; status?: string; member?: string }>
}) {
  const actor = await requireActiveRole(['TREASURER'])
  // Matching an M-Pesa payment records it, so only the Treasurer gets those controls.
  const canRecord = canRecordPayments(actor)
  const sp = await searchParams
  const page = parsePage(sp.page)
  const pageSize = 25
  const q = (sp.q || '').trim()
  const year = (sp.year || '').trim()
  const purpose = (sp.purpose || '').trim()
  const statusFilter = (sp.status || '').trim()
  const memberId = (sp.member || '').trim()
  const yearStart = year ? new Date(`${year}-01-01T00:00:00.000Z`) : null
  const yearEnd = year ? new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`) : null
  const [purposeKind, purposeId] = purpose.includes(':') ? purpose.split(':', 2) : ['', '']
  const purposeFilter: Prisma.ContributionWhereInput | null = !purpose
    ? null
    : purposeKind === 'cat'
      ? { categoryId: purposeId }
      : purposeKind === 'campaign'
        ? { campaignId: purposeId }
        : purposeKind === 'project'
          ? { projectId: purposeId }
          : {
              OR: [
                { category: { contains: purpose, mode: 'insensitive' as const } },
                { transactionCategory: { name: { contains: purpose, mode: 'insensitive' as const } } },
              ],
            }
  const andFilters: Prisma.ContributionWhereInput[] = [
    ...(purposeFilter ? [purposeFilter] : []),
    ...(memberId ? [{ userId: memberId }] : []),
    ...(q
      ? [
          {
            OR: [
              { user: { fullName: { contains: q, mode: 'insensitive' as const } } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
              { mpesaRef: { contains: q, mode: 'insensitive' as const } },
            ],
          },
        ]
      : []),
  ]
  const contributionWhere: Prisma.ContributionWhereInput = {
    status: statusFilter
      ? { in: [statusFilter as TransactionStatus] }
      : { in: ['CONFIRMED', 'RECONCILED'] },
    ...(yearStart && yearEnd ? { paidAt: { gte: yearStart, lt: yearEnd } } : {}),
    ...(andFilters.length ? { AND: andFilters } : {}),
  }

  const [members, purposeCategories, purposeCampaigns, purposeProjects, unmatchedEvents, activeCategories] = await Promise.all([
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, membershipNumber: true, phone: true, status: true } }),
    prisma.transactionCategory.findMany({ where: { type: { not: 'EXPENSE' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.contributionCampaign.findMany({ orderBy: { startsAt: 'desc' }, select: { id: true, title: true, categoryId: true, active: true } }),
    prisma.project.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true, status: true } }),
    prisma.paymentEvent.findMany({ where: { status: 'UNMATCHED' }, orderBy: { receivedAt: 'desc' } }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  const [data, chart, analytics, mpesaContributions, failedPayments, contribTotal, recent, pendingRows] =
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
        include: {
          user: { select: { fullName: true, email: true } },
          transactionCategory: { select: { name: true } },
          campaign: { select: { title: true } },
          project: { select: { title: true } },
          financialTransaction: {
            select: { reconciliation: { select: { notes: true, reconciledAt: true, reconciledBy: { select: { fullName: true } } } } },
          },
        },
        orderBy: { paidAt: 'desc' },
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.contribution.findMany({
        where: { status: 'PENDING' },
        include: {
          user: { select: { fullName: true, membershipNumber: true, email: true, phone: true } },
          transactionCategory: { select: { name: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 50,
      }),
    ])

  const catLabels = data.byCategory.map((c) => c.category || 'Uncategorized')
  const catValues = data.byCategory.map((c) => c._sum.amount ?? 0)
  const methodLabels = analytics.byMethod.map((m) => m.label)
  const methodValues = analytics.byMethod.map((m) => m.total)
  const topLabels = analytics.topContributors.map((t) => t.name)
  const topValues = analytics.topContributors.map((t) => t.total)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear - i))

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

        <PendingContributionVerify
          rows={pendingRows.map((row) => ({
            id: row.id,
            amount: row.amount,
            paidAt: row.paidAt.toISOString(),
            category: row.transactionCategory?.name || row.category,
            memberName: row.user.fullName,
            membershipNumber: row.user.membershipNumber,
            memberEmail: row.user.email,
            memberPhone: row.user.phone,
            paymentMethod: row.paymentMethod,
            mpesaRef: row.mpesaRef,
            statementRef: row.statementRef,
          }))}
        />

        {!canRecord && unmatchedEvents.length > 0 && (
          <p className="rounded-2xl border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
            {unmatchedEvents.length} M-Pesa payment{unmatchedEvents.length === 1 ? ' is' : 's are'} waiting to be matched. Only the Treasurer can match them.
          </p>
        )}
        {canRecord && <UnmatchedPayments
          events={unmatchedEvents.map((event) => ({
            id: event.id,
            provider: event.provider,
            reference: event.providerReference,
            amount: Number(event.amount),
            phone: event.phone,
            payerName: event.payerName,
            receivedAt: event.receivedAt.toISOString(),
          }))}
          members={members.filter((m) => m.status === 'ACTIVE').map((m) => ({ id: m.id, fullName: m.fullName, membershipNumber: m.membershipNumber, phone: m.phone }))}
          categories={filterSelectableCategories(activeCategories, 'income')}
          campaigns={purposeCampaigns.filter((c) => c.active).map((c) => ({ id: c.id, title: c.title, categoryId: c.categoryId }))}
          projects={purposeProjects.filter((p) => p.status !== 'COMPLETED').map((p) => ({ id: p.id, title: p.title }))}
        />}

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
            <div className="flex flex-wrap gap-2 text-sm">
              <a
                className="rounded-full border px-3 py-1.5"
                href={`/api/export/financial?from=${year || currentYear}-01-01&to=${year || currentYear}-12-31T23:59:59.999`}
              >
                Export CSV
              </a>
              <a
                className="rounded-full border px-3 py-1.5"
                href={`/api/export/financial-xlsx?from=${year || currentYear}-01-01&to=${year || currentYear}-12-31T23:59:59.999`}
              >
                Export Excel
              </a>
            </div>
          </div>
          <form method="get" className="mb-3 flex flex-wrap gap-2">
            <input name="q" defaultValue={q} placeholder="Search member or ref" className="rounded-lg border px-3 py-1.5 text-sm" />
            <select name="year" defaultValue={year} className="rounded-lg border px-3 py-1.5 text-sm">
              <option value="">All years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select name="member" defaultValue={memberId} className="rounded-lg border px-3 py-1.5 text-sm">
              <option value="">All members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}{member.membershipNumber ? ` (${member.membershipNumber})` : ''}
                </option>
              ))}
            </select>
            <select name="purpose" defaultValue={purpose} className="rounded-lg border px-3 py-1.5 text-sm">
              <option value="">All purposes</option>
              <optgroup label="Purposes">
                {purposeCategories.map((category) => <option key={category.id} value={`cat:${category.id}`}>{category.name}</option>)}
              </optgroup>
              {purposeCampaigns.length > 0 && (
                <optgroup label="Campaigns">
                  {purposeCampaigns.map((campaign) => <option key={campaign.id} value={`campaign:${campaign.id}`}>{campaign.title}</option>)}
                </optgroup>
              )}
              {purposeProjects.length > 0 && (
                <optgroup label="Projects">
                  {purposeProjects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.title}</option>)}
                </optgroup>
              )}
            </select>
            <select name="status" defaultValue={statusFilter} className="rounded-lg border px-3 py-1.5 text-sm">
              <option value="">Confirmed / reconciled</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RECONCILED">Reconciled</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button className="rounded-lg border px-3 py-1.5 text-sm">Filter</button>
          </form>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">Member</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Ref</th>
                <th>Date</th>
                <th>Reconciliation</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{c.user.fullName}</td>
                  <td>
                    {c.campaign?.title || c.project?.title || c.transactionCategory?.name || c.category || '—'}
                    {c.contributionPeriod ? <span className="text-xs text-on-surface-variant"> · {c.contributionPeriod}</span> : null}
                  </td>
                  <td>{c.amount.toLocaleString()}</td>
                  <td>{c.paymentMethod}</td>
                  <td>{c.status}</td>
                  <td>{c.mpesaRef || '—'}</td>
                  <td>{new Date(c.paidAt).toLocaleDateString()}</td>
                  <td>
                    <ReconcilePaymentButton
                      payment={{
                        id: c.id,
                        memberName: c.user.fullName,
                        amount: c.amount,
                        paidAt: c.paidAt.toISOString(),
                        method: c.paymentMethod,
                        reference: c.mpesaRef,
                        statementRef: c.statementRef,
                        purpose: c.campaign?.title || c.project?.title || c.transactionCategory?.name || c.category || '—',
                        status: c.status,
                      }}
                      reconciliation={
                        c.financialTransaction?.reconciliation
                          ? {
                              notes: c.financialTransaction.reconciliation.notes,
                              reconciledAt: c.financialTransaction.reconciliation.reconciledAt.toISOString(),
                              reconciledBy: c.financialTransaction.reconciliation.reconciledBy.fullName,
                            }
                          : null
                      }
                    />
                  </td>
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
            params={{ q, year, purpose, status: statusFilter, member: memberId }}
          />
        </section>
      </div>
    </DashboardShell>
  )
}
