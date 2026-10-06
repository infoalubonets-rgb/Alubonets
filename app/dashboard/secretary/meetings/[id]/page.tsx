import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import MeetingMinutesEditor from '@/components/meetings/MeetingMinutesEditor'
import { prisma } from '@/lib/prisma'

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [meeting, events, activeMembers] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id },
      include: {
        attendanceRecords: { include: { user: { select: { id: true, fullName: true, email: true, phone: true } } } },
        invitations: { select: { userId: true } },
      },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) } },
      select: { id: true, title: true, startsAt: true },
      orderBy: { startsAt: 'desc' },
      take: 100,
    }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, fullName: true, email: true, phone: true }, orderBy: { fullName: 'asc' } }),
  ])
  if (!meeting) notFound()
  const members = new Map(activeMembers.map((member) => [member.id, member]))
  for (const record of meeting.attendanceRecords) members.set(record.user.id, record.user)

  return (
    <DashboardShell role="SECRETARY" title="Edit minutes" nav={SECRETARY_NAV}>
      <div className="p-4 md:p-6">
        <MeetingMinutesEditor
          mode="edit"
          members={[...members.values()]}
          initialAttendance={meeting.attendanceRecords.map((record) => ({ userId: record.userId, status: record.status }))}
          invitedUserIds={meeting.invitations.map((invitation) => invitation.userId)}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt.toISOString(),
          }))}
          initial={{
            id: meeting.id,
            title: meeting.title,
            heldAt: meeting.heldAt.toISOString(),
            attendance: meeting.attendance,
            opening: meeting.opening ?? '',
            attendees: meeting.attendees ?? '',
            membersAbsent: meeting.membersAbsent ?? '',
            membersApology: meeting.membersApology ?? '',
            aob: meeting.aob ?? '',
            agenda: meeting.agenda ?? '',
            minutes: meeting.minutes ?? '',
            nextMeetingAt: meeting.nextMeetingAt?.toISOString() ?? '',
            eventId: meeting.eventId ?? '',
            status: meeting.status,
            publishedDocumentId: meeting.publishedDocumentId,
          }}
        />
      </div>
    </DashboardShell>
  )
}
