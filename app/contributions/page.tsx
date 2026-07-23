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
        where: { userId },
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
  const contributions = await getUserContributions(profile.id)

  return (
    <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
      <ContributionsClient
        contributions={contributions.map((c) => ({
          id: c.id,
          amount: c.amount,
          paidAt: c.paidAt.toISOString(),
          category: c.category,
        }))}
        userId={profile.id}
      />
    </DashboardShell>
  )
}
