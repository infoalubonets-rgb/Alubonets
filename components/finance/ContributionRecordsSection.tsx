import { cache } from 'react'
import {
  getTreasurerDashboardDataFresh,
  getContributionChartSeriesFresh,
  getContributionAnalyticsFresh,
} from '@/lib/data/queries'
import {
  ChartEmpty,
  ContributionTrendChart,
  PaymentMethodChart,
  TopContributorsChart,
} from '@/components/dashboard/Charts'
import { hasChartData } from '@/lib/chart-labels'
import PaymentsModal from '@/components/dashboard/PaymentsModal'
import PendingContributionVerify from '@/components/dashboard/PendingContributionVerify'
import UnmatchedPayments from '@/components/finance/UnmatchedPayments'
import { filterSelectableCategories } from '@/lib/payment-categories'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/** Loads everything the contribution parts need once per request, however many parts render. */
const loadRecords = cache(async () => {
  const [members, purposeCampaigns, purposeProjects, unmatchedEvents, activeCategories] = await Promise.all([
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, membershipNumber: true, phone: true, status: true } }),
    prisma.contributionCampaign.findMany({ orderBy: { startsAt: 'desc' }, select: { id: true, title: true, categoryId: true, active: true } }),
    prisma.project.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true, status: true } }),
    prisma.paymentEvent.findMany({ where: { status: 'UNMATCHED' }, orderBy: { receivedAt: 'desc' } }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  const [data, chart, analytics, mpesaContributions, failedPayments, pendingRows] = await Promise.all([
    getTreasurerDashboardDataFresh(),
    getContributionChartSeriesFresh(),
    getContributionAnalyticsFresh(),
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

  return {
    members, purposeCampaigns, purposeProjects, unmatchedEvents, activeCategories,
    data, chart, analytics, mpesaContributions, failedPayments, pendingRows,
    methodLabels: analytics.byMethod.map((m) => m.label),
    methodValues: analytics.byMethod.map((m) => m.total),
    topLabels: analytics.topContributors.map((t) => t.name),
    topValues: analytics.topContributors.map((t) => t.total),
  }
})

/**
 * Contribution parts of the Finance page, rendered where the page places them:
 * `kpis` (stat cards), `charts` (trend, methods, top contributors), `mpesa` (M-Pesa payments
 * button) and `records` (payments to verify and unmatched M-Pesa payments).
 * `canRecord` is the Treasurer only — matching an M-Pesa payment records it.
 */
export default async function ContributionRecordsSection({ canRecord, part }: { canRecord: boolean; part: 'kpis' | 'charts' | 'records' | 'mpesa' }) {
  const {
    members, purposeCampaigns, purposeProjects, unmatchedEvents, activeCategories,
    data, chart, analytics, mpesaContributions, failedPayments, pendingRows,
    methodLabels, methodValues, topLabels, topValues,
  } = await loadRecords()

  if (part === 'kpis') {
    return (
      <>
          {[
            { label: 'Collected this month', value: `KES ${Math.round(data.monthTotal).toLocaleString()}` },
            { label: 'Contributions recorded', value: data.count.toLocaleString() },
            { label: 'Contributing members', value: analytics.contributorCount.toLocaleString() },
            { label: 'M-Pesa payments', value: (analytics.byMethod.find(m => m.method === 'MPESA')?.count ?? 0).toLocaleString() },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-outline-variant p-5">
              <p className="text-sm text-on-surface-variant">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
      </>
    )
  }

  if (part === 'mpesa') {
    return (
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
    )
  }

  if (part === 'charts') {
    return (
      <>
          <div className="rounded-2xl border border-outline-variant bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Monthly contribution trend</h2>
            {hasChartData(chart.values) ? (
              <ContributionTrendChart labels={chart.labels} values={chart.values} />
            ) : (
              <ChartEmpty message="No confirmed contributions recorded yet." />
            )}
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Payment methods</h2>
            {hasChartData(methodValues) ? (
              <PaymentMethodChart labels={methodLabels} values={methodValues} />
            ) : (
              <ChartEmpty message="No payment method data yet." />
            )}
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Top contributors</h2>
            {hasChartData(topValues) ? (
              <TopContributorsChart labels={topLabels} values={topValues} />
            ) : (
              <ChartEmpty message="No contributor data yet." />
            )}
          </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
        <div id="pending">
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
        </div>

        <div id="unmatched" />
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

    </div>
  )
}

