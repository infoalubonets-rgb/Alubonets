import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV, WELFARE_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { actionReviewWelfare } from '@/app/actions/domain'
import { getTreasurerDashboardData } from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { publishFundingRequestToGovernance } from '@/app/actions/loans'
import RecordWelfareDisbursementForm from '@/components/finance/RecordWelfareDisbursementForm'

export default async function TreasurerWelfarePage() {
  const welfareOn = await isFeatureEnabled(FEATURE_FLAGS.welfareEnabled)
  if (!welfareOn) notFound()
  const data = await getTreasurerDashboardData()
  const accounts = await prisma.financialAccount.findMany({
    where: { active: true, code: { in: ['CASH', 'BANK', 'MPESA', 'WELFARE_FUND'] } },
    orderBy: { name: 'asc' },
  })
  const nav = withOptionalNav(TREASURER_NAV, WELFARE_NAV_ITEMS.treasurer, '/financial-reports')

  return (
    <DashboardShell role="TREASURER" title="Welfare reviews" nav={nav}>
      <div className="space-y-4 p-4 md:p-6">
        {data.pendingWelfare.length === 0 && (
          <p className="text-sm text-on-surface-variant rounded-xl border p-4 bg-surface">
            No pending welfare requests.
          </p>
        )}
        {data.pendingWelfare.map((w) => (
          <div key={w.id} className="border rounded-lg p-3 bg-surface">
            <p className="font-medium">
              {w.user.fullName} — {w.description}
            </p>
            <p className="text-sm text-on-surface-variant">
              Amount: {w.amount?.toLocaleString() ?? '—'}
            </p>
            <form action={publishFundingRequestToGovernance} className="mt-2">
              <input type="hidden" name="requestType" value="WELFARE" />
              <input type="hidden" name="requestId" value={w.id} />
              <button className="rounded-full border border-primary px-3 py-1.5 text-xs font-bold text-primary">Publish to Governance</button>
            </form>
            {w.status === 'PENDING' ? <div className="flex gap-2 mt-2">
              {(['APPROVED', 'REJECTED'] as const).map((status) => (
                <form key={status} action={actionReviewWelfare}>
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="status" value={status} />
                  <button className="px-3 py-1.5 border rounded-lg text-xs">{status}</button>
                </form>
              ))}
            </div> : <RecordWelfareDisbursementForm welfareRequestId={w.id} defaultAmount={w.amount} accounts={accounts} />}
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
