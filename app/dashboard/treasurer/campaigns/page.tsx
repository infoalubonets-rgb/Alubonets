import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { filterSelectableCategories } from '@/lib/payment-categories'
import { appTodayInputValue } from '@/lib/dates'
import { moneyNumber } from '@/lib/projects'
import CampaignForm from '@/components/finance/CampaignForm'
import { setContributionCampaignActive } from '@/app/actions/finance'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  await requireActiveRole(['TREASURER', 'ADMIN'])
  const [campaigns, raisedRows, categories] = await Promise.all([
    prisma.contributionCampaign.findMany({
      orderBy: [{ active: 'desc' }, { startsAt: 'desc' }],
      include: { category: { select: { name: true } }, _count: { select: { obligations: true } } },
    }),
    prisma.contribution.groupBy({
      by: ['campaignId'],
      where: { campaignId: { not: null }, status: { in: ['CONFIRMED', 'RECONCILED'] } },
      _sum: { amount: true },
    }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])
  const raised = new Map(raisedRows.map((row) => [row.campaignId, moneyNumber(row._sum.amount)]))
  const today = appTodayInputValue()

  return (
    <DashboardShell role="TREASURER" title="Contribution campaigns" nav={TREASURER_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl text-primary">Campaigns</h2>
          <p className="mt-1 text-xs text-on-surface-variant">Open a campaign to see who has paid, who still owes, and to waive a member.</p>
          <div className="mt-4 space-y-3">
            {campaigns.length === 0 && <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">No campaigns yet.</p>}
            {campaigns.map((campaign) => {
              const target = moneyNumber(campaign.targetAmount)
              const collected = raised.get(campaign.id) ?? 0
              const percent = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0
              return (
                <div key={campaign.id} className={`rounded-xl border p-4 ${campaign.active ? '' : 'opacity-70'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/dashboard/treasurer/campaigns/${campaign.id}`} className="font-semibold text-primary hover:underline">
                        {campaign.title}
                      </Link>
                      <p className="text-xs text-on-surface-variant">
                        {campaign.category.name} · Starts {campaign.startsAt.toLocaleDateString('en-KE')}
                        {campaign.dueAt ? ` · Due ${campaign.dueAt.toLocaleDateString('en-KE')}` : ''}
                        {campaign.perMemberTarget ? ` · KES ${moneyNumber(campaign.perMemberTarget).toLocaleString()} per member (${campaign._count.obligations} members)` : ''}
                        {campaign.active ? '' : ' · Inactive'}
                      </p>
                    </div>
                    <form action={setContributionCampaignActive}>
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <input type="hidden" name="active" value={campaign.active ? 'false' : 'true'} />
                      <button className="text-xs font-semibold text-primary underline">{campaign.active ? 'Deactivate' : 'Reactivate'}</button>
                    </form>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
                    <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    KES {collected.toLocaleString()} of KES {target.toLocaleString()} ({percent}%)
                  </p>
                </div>
              )
            })}
          </div>
        </section>
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl text-primary">New campaign</h2>
          <div className="mt-3">
            <CampaignForm categories={filterSelectableCategories(categories, 'income')} today={today} />
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
