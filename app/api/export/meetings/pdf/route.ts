import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { buildMeetingMinutesPdf } from '@/lib/pdf/minutes'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!['ADMIN', 'SECRETARY'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const meetings = await prisma.meeting.findMany({
    orderBy: { heldAt: 'desc' },
    take: 50,
    include: { recorder: { select: { fullName: true, email: true } } },
  })

  const merged = await PDFDocument.create()

  for (const meeting of meetings) {
    const bytes = await buildMeetingMinutesPdf(meeting)
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((p) => merged.addPage(p))
  }

  const output = await merged.save()
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(Buffer.from(output), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="alubonets-meetings-${date}.pdf"`,
    },
  })
}
