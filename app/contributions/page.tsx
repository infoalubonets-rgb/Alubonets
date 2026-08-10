import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { TAGS } from '@/lib/data/queries'
import type { Role } from '@/lib/auth/types'
import ContributionsClient from '@/components/dashboard/ContributionsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My contributions' }

function getUserContributions(userId: string) {
  return unstable_cache(
    async () =>
      prisma.contribution.findMany({
        where: { userId, status: { in: ['CONFIRMED', 'RECONCILED'] } },
        select: { id: true, amount: true, paidAt: true, category: true },
        orderBy: { paidAt: 'desc' },
      }),
    [`contributions-${userId}`],
    { tags: [TAGS.contributions] },
  )()
}

export default async function ContributionsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/contributions')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  let result
  try {
    result = await Promise.all([
      getUserContributions(profile.id),
      prisma.memberContributionObligation.findMany({
        where: { userId: profile.id },
        include: { campaign: { include: { contributions: { where: { userId: profile.id, status: { in: ['CONFIRMED','RECONCILED'] } } } } } },
        orderBy: { campaign: { startsAt: 'desc' } },
      }),
    ])
  } catch (error) {
    console.error('Could not load member contributions', error)
    return (
      <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
        <section className="mx-auto mt-8 max-w-xl rounded-2xl border border-error/30 bg-surface p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-error">cloud_off</span>
          <h2 className="mt-2 font-h3 text-xl text-primary">Contributions are temporarily unavailable</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            The database could not be reached. Your records are safe; please try loading this page again.
          </p>
          <a href="/contributions" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm text-on-primary">
            Try again
          </a>
        </section>
      </DashboardShell>
    )
  }
  const [contributions, obligations] = result

  return (
    <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
      <section className="mb-5 rounded-2xl border bg-surface p-5">
        <h2 className="font-h3 text-xl text-primary">Contribution requests and balances</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {obligations.length === 0 ? <p className="text-sm text-on-surface-variant">No active contribution requests.</p> : obligations.map((obligation) => {
            const target = Number(obligation.targetAmount)
            const paid = obligation.campaign.contributions.reduce((sum, item) => sum + item.amount, 0)
            const remaining = Math.max(0, target - paid)
            const percent = target ? Math.min(100, (paid / target) * 100) : 0
            return <article key={obligation.id} className="rounded-xl bg-surface-container-low p-4"><div className="flex justify-between gap-2"><b>{obligation.campaign.title}</b><span className="text-xs">{obligation.status.replaceAll('_',' ')}</span></div><p className="mt-1 text-sm">{obligation.campaign.description}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-outline-variant"><div className="h-full bg-secondary-container" style={{width:`${percent}%`}}/></div><div className="mt-2 flex justify-between text-sm"><span>Paid: KES {paid.toLocaleString()}</span><b>Remaining: KES {remaining.toLocaleString()}</b></div>{obligation.campaign.dueAt&&<p className="mt-1 text-xs text-on-surface-variant">Due {obligation.campaign.dueAt.toLocaleDateString()}</p>}</article>
          })}
        </div>
      </section>
      <ContributionsClient
        contributions={contributions.map((c) => ({
          id: c.id,
          amount: c.amount,
          paidAt: new Date(c.paidAt).toISOString(),
          category: c.category,
        }))}
        userId={profile.id}
      />
    </DashboardShell>
  )
}
