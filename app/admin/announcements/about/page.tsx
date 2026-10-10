import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import CommitteeProfilesClient from '@/components/admin/CommitteeProfilesClient'
import { requireAdmin } from '@/lib/auth/session'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'About Us profiles — Alubonets' }
export const dynamic = 'force-dynamic'

export default async function AboutProfilesPage() {
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
    <DashboardShell
      role="ADMIN"
      title="About Us profiles"
      nav={nav}
      pageAction={
        <Link
          href="/about"
          target="_blank"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-secondary-container/40 bg-secondary-container/10 px-3.5 text-[12px] font-label-bold text-secondary transition hover:bg-secondary-container/20"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          View About page
        </Link>
      }
    >
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
