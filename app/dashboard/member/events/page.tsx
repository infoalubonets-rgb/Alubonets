import DashboardShell from '@/components/dashboard/DashboardShell'
import MemberEventsClient from '@/components/dashboard/MemberEventsClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'

export default async function MemberEventsPage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
    'MEMBER',
  ])
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { isPublic: true },
        { audienceType: 'ALL_MEMBERS' },
        { audienceType: 'SELECTED_ROLES', audienceRoles: { has: actor.role } },
        { invitations: { some: { userId: actor.id } } },
        { rsvps: { some: { userId: actor.id } } },
      ],
    },
    include: {
      rsvps: { where: { userId: actor.id }, take: 1 },
      _count: { select: { rsvps: true } },
    },
    orderBy: { startsAt: 'asc' },
  })

  const upcoming = events
    .filter((e) => e.startsAt >= new Date())
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      rsvpCount: e._count.rsvps,
      myRsvp: e.rsvps[0] ? { status: e.rsvps[0].status } : undefined,
      reportPublishedAt: e.reportPublishedAt?.toISOString() ?? null,
    }))
  const past = events
    .filter((e) => e.startsAt < new Date())
    .reverse()
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      rsvpCount: e._count.rsvps,
      myRsvp: e.rsvps[0] ? { status: e.rsvps[0].status } : undefined,
      reportPublishedAt: e.reportPublishedAt?.toISOString() ?? null,
    }))

  return (
    <DashboardShell role={actor.role} title="Events" nav={navForRole(actor.role)}>
      <div className="p-4 md:p-6">
        <MemberEventsClient upcoming={upcoming} past={past} />
      </div>
    </DashboardShell>
  )
}
