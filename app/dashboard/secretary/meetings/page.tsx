import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import MeetingsListClient from '@/components/meetings/MeetingsListClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SecretaryMeetingsPage() {
  const meetings = await prisma.meeting.findMany({
    orderBy: { heldAt: 'desc' },
    include: { publishedDocument: { select: { id: true, fileUrl: true } } },
  })

  return (
    <DashboardShell role="SECRETARY" title="Minutes & reports" nav={SECRETARY_NAV}>
      <div className="dashboard-page-action flex justify-end">
        <Link href="/meetings-reports" className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-5 py-2.5 text-sm font-label-bold text-on-primary shadow-[0_4px_14px_rgba(254,128,21,0.28)]">
          <span className="material-symbols-outlined text-[18px]">assessment</span>
          Meetings & reports
        </Link>
      </div>
      <MeetingsListClient meetings={meetings} />
    </DashboardShell>
  )
}
