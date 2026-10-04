import DashboardShell from '@/components/dashboard/DashboardShell'
import MemberEventsClient from '@/components/dashboard/MemberEventsClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import MemberGate from '@/components/public/MemberGate'
import { getMemberStanding } from '@/lib/membership-standing-sync'
import { hasPaidUpAccess } from '@/lib/membership-standing'

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
        {
          audienceType: 'BRANCH_MEMBERS',
          audiencePrincipalId: actor.isPrincipal ? actor.id : actor.principalMemberId || '__none__',
        },
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
  const creationLogs = await prisma.auditLog.findMany({
    where: { action: 'EVENT_CREATE', entity: 'Event', entityId: { in: events.map((event) => event.id) } },
    select: { entityId: true, userId: true },
    orderBy: { createdAt: 'asc' },
  })
  const creatorByEvent = new Map(creationLogs.map((log) => [log.entityId, log.userId]))
  const canDeleteAnyEvent = actor.isSuperAdmin || actor.role === 'ADMIN'
  const isOrganizer = actor.role === 'ORGANIZER' || actor.role === 'SECRETARY'
    || actor.dashboardAccess.includes('ORGANIZER') || actor.dashboardAccess.includes('SECRETARY')
  const now = new Date()
  const toCard = (event: (typeof events)[number]) => ({
    id: event.id, title: event.title, description: event.description, location: event.location, mapsUrl: event.mapsUrl,
    startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null,
    imageUrl: event.imageUrl, isPublic: event.isPublic, capacity: event.capacity,
    rsvpCount: event._count.rsvps,
    myRsvp: event.rsvps[0] ? { status: event.rsvps[0].status } : undefined,
    reportPublishedAt: event.reportPublishedAt?.toISOString() ?? null,
    canDelete: canDeleteAnyEvent || (isOrganizer && creatorByEvent.get(event.id) === actor.id),
  })

  const { standing, reason } = await getMemberStanding(actor.id)
  const paidUp = hasPaidUpAccess({ role: actor.role, isSuperAdmin: actor.isSuperAdmin, standing })
  const upcoming = paidUp
    ? events
        .filter((event) => event.startsAt >= now)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map(toCard)
    : []
  const past = events
    .filter((event) => event.startsAt < now)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .map(toCard)

  return (
    <DashboardShell role={actor.role} title="Events" nav={navForRole(actor.role)}>
      <div className="space-y-4 p-4 md:p-6">
        {!paidUp && <MemberGate variant="renew" what="Upcoming events" reason={reason} />}
        <MemberEventsClient upcoming={upcoming} past={past} />
      </div>
    </DashboardShell>
  )
}
