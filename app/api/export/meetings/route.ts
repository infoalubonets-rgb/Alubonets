import { NextResponse } from 'next/server'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!['ADMIN', 'SECRETARY'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const meetings = await prisma.meeting.findMany({ orderBy: { heldAt: 'desc' }, take: 50 })

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Alubonets SHG — Meeting Minutes Export',
            heading: HeadingLevel.HEADING_1,
          }),
          ...meetings.flatMap((m) => [
            new Paragraph({
              text: `${m.title} (${m.heldAt.toLocaleDateString()})`,
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [new TextRun(`Attendance: ${m.attendance}`)],
            }),
            new Paragraph({
              children: [new TextRun(`Agenda: ${m.agenda || '—'}`)],
            }),
            new Paragraph({
              children: [new TextRun(`Minutes: ${m.minutes || '—'}`)],
            }),
            new Paragraph({ text: '' }),
          ]),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="meetings.docx"',
    },
  })
}
