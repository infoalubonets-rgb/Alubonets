import DashboardShell from '@/components/dashboard/DashboardShell'
import ModuleDisabled from '@/components/dashboard/ModuleDisabled'
import { EXECUTIVE_NAV, WELFARE_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import WelfareReviewCard from '@/components/dashboard/WelfareReviewCard'
import { requireActiveRole } from '@/lib/auth/session'

export default async function ExecutiveWelfarePage() {
  await requireActiveRole(['EXECUTIVE', 'ADMIN'])
  const welfareOn = await isFeatureEnabled(FEATURE_FLAGS.welfareEnabled)
  if (!welfareOn) return <ModuleDisabled module="Welfare" />
  const nav = withOptionalNav(EXECUTIVE_NAV, WELFARE_NAV_ITEMS.executive, '/financial-reports')
  const pending = await prisma.welfareRequest.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    include: {
      user: { select: { fullName: true, email: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <DashboardShell role="EXECUTIVE" title="Welfare approvals" nav={nav}>
      <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
        <p className="text-sm text-on-surface-variant">
          Executive approval is required in addition to Treasurer approval. Confidential requests are visible only to authorized officers. You cannot approve your own request.
        </p>
        {pending.length === 0 && (
          <p className="text-sm text-on-surface-variant rounded-xl border p-4 bg-surface">
            No welfare requests awaiting Executive review.
          </p>
        )}
        {pending.map((w) => (
          <WelfareReviewCard key={w.id} office="EXECUTIVE" request={w} />
        ))}
      </div>
    </DashboardShell>
  )
}
