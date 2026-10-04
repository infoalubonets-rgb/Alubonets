import DashboardShell from '@/components/dashboard/DashboardShell'
import CommitteeProfilesClient from '@/components/admin/CommitteeProfilesClient'
import { requireAdmin } from '@/lib/auth/session'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'About Us profiles — Alubonets' }
export const dynamic = 'force-dynamic'

export default async function AdminCommitteePage() {
  await requireAdmin()
  const [profiles, members, nav] = await Promise.all([
    prisma.committeeProfile.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { fullName: true } } },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
    navWithLoans('ADMIN'),
  ])

  return (
    <DashboardShell role="ADMIN" title="About Us profiles" nav={nav}>
      <div className="p-4 md:p-6">
        <CommitteeProfilesClient
          members={members}
          rows={profiles.map((profile) => ({
            id: profile.id,
            userId: profile.userId,
            memberName: profile.user?.fullName ?? null,
            name: profile.name,
            position: profile.position,
            responsibilities: profile.responsibilities,
            biography: profile.biography,
            photoUrl: profile.photoUrl,
            displayOrder: profile.displayOrder,
            published: profile.status === 'PUBLISHED',
          }))}
        />
      </div>
    </DashboardShell>
  )
}
