import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { buildMeetingMinutesPdf, minutesFilename } from '@/lib/pdf/minutes'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { recorder: { select: { fullName: true, email: true } } },
  })
  if (!meeting) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const staffRoles = ['ADMIN', 'SECRETARY', 'EXECUTIVE']
  const isStaff =
    profile.isSuperAdmin ||
    staffRoles.includes(profile.role) ||
    profile.dashboardAccess.includes('SECRETARY')

  if (!isStaff && meeting.status !== 'FINAL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bytes = await buildMeetingMinutesPdf(meeting)
  const filename = minutesFilename(meeting)

  const download = _req.nextUrl.searchParams.get('download') === '1'
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    },
  })
}
