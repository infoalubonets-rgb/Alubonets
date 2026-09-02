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
  let contributions
  try {
    contributions = await getUserContributions(profile.id)
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
  return (
    <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
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
