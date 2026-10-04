import DashboardShell from '@/components/dashboard/DashboardShell'
import ModuleDisabled from '@/components/dashboard/ModuleDisabled'
import { TREASURER_NAV, WELFARE_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { getTreasurerDashboardData } from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import WelfareReviewCard from '@/components/dashboard/WelfareReviewCard'

export default async function TreasurerWelfarePage() {
  const welfareOn = await isFeatureEnabled(FEATURE_FLAGS.welfareEnabled)
  if (!welfareOn) return <ModuleDisabled module="Welfare" />
  const data = await getTreasurerDashboardData()
  const accounts = await prisma.financialAccount.findMany({
    where: { active: true, code: { in: ['CASH', 'BANK', 'MPESA', 'WELFARE_FUND'] } },
    orderBy: { name: 'asc' },
  })
  const nav = withOptionalNav(TREASURER_NAV, WELFARE_NAV_ITEMS.treasurer, '/financial-reports')

  return (
    <DashboardShell role="TREASURER" title="Welfare reviews" nav={nav}>
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-on-surface-variant">
          Treasurer approval is required first or in parallel with Executive. Both offices must approve before disbursement. You cannot approve your own request.
        </p>
        {data.pendingWelfare.length === 0 && (
          <p className="text-sm text-on-surface-variant rounded-xl border p-4 bg-surface">
            No pending welfare requests.
          </p>
        )}
        {data.pendingWelfare.map((w) => (
          <WelfareReviewCard
            key={w.id}
            office="TREASURER"
            accounts={accounts}
            request={w}
          />
        ))}
      </div>
    </DashboardShell>
  )
}
