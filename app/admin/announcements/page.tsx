import DashboardShell from '@/components/dashboard/DashboardShell'
import StatCard from '@/components/dashboard/StatCard'
import AnnouncementsAdminClient from '@/components/admin/AnnouncementsAdminClient'
import { requireAdmin } from '@/lib/auth/session'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import {
  createTargetedAnnouncement,
  retryFailedAnnouncementEmails,
  upsertAnnouncementTemplate,
} from '@/app/actions/announcements'
import { nowInputValue } from '@/lib/dates'
import AssignedContactInbox from '@/components/admin/AssignedContactInbox'

export default async function AdminAnnouncementsPage() {
  const actor = await requireAdmin()
  const [announcements, templates, members, branches] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        receipts: { select: { emailStatus: true } },
        author: { select: { fullName: true } },
      },
    }),
    prisma.announcementTemplate.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.memberProfile.findMany({
      where: { familyBranch: { not: null } },
      select: { familyBranch: true },
      distinct: ['familyBranch'],
    }),
  ])

  const rows = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    author: a.author.fullName,
    createdAt: a.createdAt.toISOString(),
    sent: a.receipts.filter((r) => r.emailStatus === 'SENT').length,
    failed: a.receipts.filter((r) => r.emailStatus === 'FAILED').length,
  }))
  const totalSent = rows.reduce((sum, a) => sum + a.sent, 0)
  const totalFailed = rows.reduce((sum, a) => sum + a.failed, 0)

  return (
    <DashboardShell role="ADMIN" title="Communications" nav={ADMIN_NAV}>
      <div className="space-y-5 p-4 md:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard icon="campaign" label="Notifications sent" value={String(rows.length)} accent="orange" />
          <StatCard icon="mark_email_read" label="Emails delivered" value={String(totalSent)} />
          <StatCard icon="error" label="Emails failed" value={String(totalFailed)} accent={totalFailed > 0 ? 'red' : 'default'} />
        </section>

        <AnnouncementsAdminClient
          createAction={createTargetedAnnouncement}
          retryAction={retryFailedAnnouncementEmails}
          templateAction={upsertAnnouncementTemplate}
          announcements={rows}
          templates={templates.map((t) => ({ id: t.id, key: t.key, name: t.name }))}
          members={members}
          branches={branches.map((b) => b.familyBranch as string)}
          nowInputValue={nowInputValue()}
        />
        {actor.isSuperAdmin && <AssignedContactInbox adminId={actor.id} />}
      </div>
    </DashboardShell>
  )
}
