import Link from 'next/link'
import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { campaignPurposeCategories } from '@/lib/payment-categories'
import { appTodayInputValue } from '@/lib/dates'
import { getCampaignProgress } from '@/lib/campaigns'
import CampaignForm from '@/components/finance/CampaignForm'
import { restoreCampaignObligation, setContributionCampaignActive, waiveCampaignObligation } from '@/app/actions/finance'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Paid',
  PARTIALLY_PAID: 'Part paid',
  OUTSTANDING: 'Not paid',
  WAIVED: 'Waived',
  NO_TARGET: 'No target',
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveRole(['TREASURER', 'ADMIN'])
  const { id } = await params
  const [progress, categories] = await Promise.all([
    getCampaignProgress(id),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])
  if (!progress) notFound()
  const { campaign, raised, percent, rows } = progress
  const paidCount = rows.filter((row) => row.status === 'PAID').length
  // Keep an older campaign's purpose selectable so saving the form doesn't silently change it.
  const purposes = campaignPurposeCategories(categories)
  const current = categories.find((category) => category.id === campaign.categoryId)
  const purposeOptions = current && !purposes.some((p) => p.id === current.id) ? [current, ...purposes] : purposes
  const owing = rows.reduce((sum, row) => sum + row.balance, 0)

  return (
    <DashboardShell role="TREASURER" title={campaign.title} nav={TREASURER_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <Link href="/dashboard/treasurer/campaigns" className="text-sm text-primary underline">All campaigns</Link>
        <section className="rounded-2xl border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase text-on-surface-variant">{campaign.categoryName}{campaign.active ? '' : ' · Inactive'}</p>
            <form action={setContributionCampaignActive}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <input type="hidden" name="active" value={campaign.active ? 'false' : 'true'} />
              <button className="text-xs font-semibold text-primary underline">{campaign.active ? 'Deactivate' : 'Reactivate'}</button>
            </form>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
            <div><p className="text-xs text-on-surface-variant">Raised</p><b>KES {raised.toLocaleString()}</b></div>
            <div><p className="text-xs text-on-surface-variant">Overall target</p><b>KES {campaign.target.toLocaleString()} ({percent}%)</b></div>
            <div><p className="text-xs text-on-surface-variant">Members fully paid</p><b>{paidCount} of {rows.filter((row) => row.obligationId).length}</b></div>
            <div><p className="text-xs text-on-surface-variant">Still owed by members</p><b>KES {owing.toLocaleString()}</b></div>
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl text-primary">Members</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Member</th><th>Target</th><th>Paid</th><th>Balance</th><th>Status</th><th>Waiver</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-on-surface-variant">No member targets or payments yet.</td></tr>
                )}
                {rows.map((row) => (
                  <tr key={row.userId} className="border-t">
                    <td className="py-2">{row.fullName}{row.membershipNumber ? <span className="text-xs text-on-surface-variant"> · {row.membershipNumber}</span> : null}</td>
                    <td>{row.target ? `KES ${row.target.toLocaleString()}` : '—'}</td>
                    <td>KES {row.paid.toLocaleString()}</td>
                    <td>{row.balance ? `KES ${row.balance.toLocaleString()}` : '—'}</td>
                    <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                    <td>
                      {row.obligationId && row.status === 'WAIVED' && (
                        <form action={restoreCampaignObligation}>
                          <input type="hidden" name="obligationId" value={row.obligationId} />
                          <button className="text-xs text-primary underline">Undo waiver</button>
                        </form>
                      )}
                      {row.obligationId && row.status !== 'WAIVED' && row.status !== 'PAID' && (
                        <form action={waiveCampaignObligation} className="flex gap-1">
                          <input type="hidden" name="obligationId" value={row.obligationId} />
                          <input name="reason" required minLength={3} placeholder="Reason" className="w-28 rounded border px-2 py-1 text-xs" />
                          <button className="text-xs text-error underline">Waive</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl text-primary">Edit campaign</h2>
          <div className="mt-3">
            <CampaignForm
              categories={purposeOptions}
              today={appTodayInputValue()}
              initial={{
                id: campaign.id,
                title: campaign.title,
                description: campaign.description,
                targetAmount: campaign.target,
                perMemberTarget: campaign.perMemberTarget,
                categoryId: campaign.categoryId,
                startsAt: campaign.startsAt.toISOString().slice(0, 10),
                dueAt: campaign.dueAt ? campaign.dueAt.toISOString().slice(0, 10) : null,
              }}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
