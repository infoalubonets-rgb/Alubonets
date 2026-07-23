import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import AnnouncementComposer from '@/components/dashboard/AnnouncementComposer'
import MarkAnnouncementsRead from '@/components/dashboard/MarkAnnouncementsRead'
import AnnouncementsClient from '@/components/dashboard/AnnouncementsClient'
import { navForRole } from '@/lib/dashboard/nav'
import { getAnnouncementsForUser } from '@/lib/data/queries'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'

export const metadata = { title: 'Announcements — Alubonets' }

export default async function AnnouncementsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/announcements')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  const canSend = ['ADMIN', 'EXECUTIVE', 'ORGANIZER', 'SECRETARY', 'TREASURER'].includes(role) || profile.isSuperAdmin

  const [announcements, members] = await Promise.all([
    getAnnouncementsForUser(profile.id),
    canSend
      ? prisma.user.findMany({
          where: { status: 'ACTIVE', id: { not: profile.id } },
          select: { id: true, fullName: true, email: true },
          orderBy: { fullName: 'asc' },
        })
      : Promise.resolve([]),
  ])

  return (
    <DashboardShell role={role} title="Announcements" nav={navForRole(role)}>
      <MarkAnnouncementsRead />
      <div className="max-w-3xl mx-auto space-y-5 pb-10">
        {canSend && (
          <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 border-t-4 border-t-secondary-container">
            <h2 className="font-label-bold text-sm text-on-surface mb-3">Send announcement</h2>
            <AnnouncementComposer members={members} />
          </section>
        )}
        <AnnouncementsClient
          announcements={announcements}
          currentUserId={profile.id}
          isSuperAdmin={profile.isSuperAdmin ?? false}
        />
      </div>
    </DashboardShell>
  )
}
