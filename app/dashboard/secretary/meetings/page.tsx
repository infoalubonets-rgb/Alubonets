import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import MeetingsListClient from '@/components/meetings/MeetingsListClient'

export const dynamic = 'force-dynamic'

export default async function SecretaryMeetingsPage() {
  const meetings = await prisma.meeting.findMany({
    orderBy: { heldAt: 'desc' },
    include: { publishedDocument: { select: { id: true, fileUrl: true } } },
  })

  return (
    <DashboardShell role="SECRETARY" title="Meetings" nav={SECRETARY_NAV}>
      <MeetingsListClient meetings={meetings} />
    </DashboardShell>
  )
}
