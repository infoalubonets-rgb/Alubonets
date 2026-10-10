import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { campaignPurposeCategories } from '@/lib/payment-categories'
import { appTodayInputValue } from '@/lib/dates'
import { moneyNumber } from '@/lib/projects'
import CampaignsTable from '@/components/finance/CampaignsTable'
import NewCampaignButton from '@/components/finance/NewCampaignButton'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  await requireActiveRole(['TREASURER', 'ADMIN'])
  const [campaigns, raisedRows, categories] = await Promise.all([
    prisma.contributionCampaign.findMany({
      orderBy: [{ active: 'desc' }, { startsAt: 'desc' }],
      include: { category: { select: { name: true } }, _count: { select: { contributions: true } } },
    }),
    prisma.contribution.groupBy({
      by: ['campaignId'],
      where: { campaignId: { not: null }, status: { in: ['CONFIRMED', 'RECONCILED'] } },
      _sum: { amount: true },
    }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])
  const raised = new Map(raisedRows.map((row) => [row.campaignId, moneyNumber(row._sum.amount)]))

  return (
    <DashboardShell
      role="TREASURER"
      title="Campaigns"
      nav={TREASURER_NAV}
      pageAction={
        <NewCampaignButton categories={campaignPurposeCategories(categories)} today={appTodayInputValue()} />
      }
    >
      <div className="p-4 md:p-6">
        <CampaignsTable
          campaigns={campaigns.map((campaign) => {
            const target = moneyNumber(campaign.targetAmount)
            const collected = raised.get(campaign.id) ?? 0
            return {
              id: campaign.id,
              title: campaign.title,
              categoryName: campaign.category.name,
              startsAt: campaign.startsAt.toISOString(),
              dueAt: campaign.dueAt?.toISOString() ?? null,
              target,
              collected,
              percent: target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0,
              active: campaign.active,
              payments: campaign._count.contributions,
            }
          })}
        />
      </div>
    </DashboardShell>
  )
}
