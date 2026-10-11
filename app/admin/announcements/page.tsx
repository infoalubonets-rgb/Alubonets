import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { createTargetedAnnouncement, retryFailedAnnouncementEmails } from '@/app/actions/announcements'
import { updateContactDestination } from '@/app/actions/contact'
import AssignedContactInbox from '@/components/admin/AssignedContactInbox'
import CommunicationsAdminRoot from '@/components/admin/CommunicationsAdminRoot'
import { emailTestModeRecipient } from '@/lib/email/resend'
import { CONTACT_EMAIL } from '@/lib/constants'

export default async function AdminAnnouncementsPage() {
  const actor = await requireAdmin()
  const [announcements, members, contactSetting] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        receipts: { select: { emailStatus: true, userId: true, readAt: true } },
        author: { select: { fullName: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.appSetting.findUnique({ where: { key: 'contact_destination_email' } }),
  ])

  const rows = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    author: a.author.fullName,
    createdAt: a.createdAt.toISOString(),
    sent: a.receipts.filter((r) => r.emailStatus === 'SENT').length,
    failed: a.receipts.filter((r) => r.emailStatus === 'FAILED').length,
    canMarkRead: a.receipts.some(r => r.userId === actor.id),
    read: a.receipts.some(r => r.userId === actor.id && r.readAt !== null),
  }))
  const totalSent = rows.reduce((sum, a) => sum + a.sent, 0)
  const totalFailed = rows.reduce((sum, a) => sum + a.failed, 0)

  return (
    <CommunicationsAdminRoot
      isSuperAdmin={actor.isSuperAdmin}
      contactDestinationEmail={contactSetting?.value || CONTACT_EMAIL}
      updateContactDestination={updateContactDestination}
      createAction={createTargetedAnnouncement}
      retryAction={retryFailedAnnouncementEmails}
      announcements={rows}
      members={members}
      totalSent={totalSent}
      totalFailed={totalFailed}
      emailTestRecipient={emailTestModeRecipient()}
      contactInbox={
        actor.isSuperAdmin ? (
          <AssignedContactInbox adminId={actor.id} isSuperAdmin />
        ) : null
      }
    />
  )
}
