import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import MeetingMinutesEditor from '@/components/meetings/MeetingMinutesEditor'
import { prisma } from '@/lib/prisma'

export default async function NewMeetingPage() {
  const [events, members] = await Promise.all([
    prisma.event.findMany({
      where: { startsAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) } },
      select: { id: true, title: true, startsAt: true },
      orderBy: { startsAt: 'desc' },
      take: 100,
    }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, fullName: true, email: true, phone: true }, orderBy: { fullName: 'asc' } }),
  ])

  return (
    <DashboardShell role="SECRETARY" title="New meeting" nav={SECRETARY_NAV}>
      <div className="p-4 md:p-6">
        <MeetingMinutesEditor
          mode="create"
          members={members}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt.toISOString(),
          }))}
          initial={{
            title: '',
            heldAt: new Date().toISOString(),
            attendance: 0,
            opening: '',
            attendees: '',
            membersAbsent: '',
            membersApology: '',
            aob: '',
            agenda: '',
            minutes: '',
            nextMeetingAt: '',
            eventId: '',
            status: 'DRAFT',
          }}
        />
      </div>
    </DashboardShell>
  )
}
