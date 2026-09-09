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
  const [meeting, events] = await Promise.all([
    prisma.meeting.findUnique({ where: { id } }),
    prisma.event.findMany({
      where: { startsAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) } },
      select: { id: true, title: true, startsAt: true },
      orderBy: { startsAt: 'desc' },
      take: 100,
    }),
  ])
  if (!meeting) notFound()

  return (
    <DashboardShell role="SECRETARY" title="Edit minutes" nav={SECRETARY_NAV}>
      <div className="p-4 md:p-6">
        <MeetingMinutesEditor
          mode="edit"
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
