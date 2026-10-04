import { NextRequest, NextResponse } from 'next/server'
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  PageBreak,
  SectionType,
  TextRun,
} from 'docx'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { ATTENDANCE_RECORDS_INCLUDE, attendanceLists } from '@/lib/meeting-attendance'

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20, color: '001f50', allCaps: true })],
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'fe8015', space: 4 } },
  })
}

function bodyPara(text: string | null | undefined): Paragraph[] {
  if (!text?.trim()) return []
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line || ' ', size: 20, color: '333333' })],
          spacing: { after: 60 },
        }),
    )
}

function labelValue(label: string, value: string | null | undefined): Paragraph[] {
  if (!value?.trim()) return []
  return [
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20, color: '001f50' }),
        new TextRun({ text: value.trim(), size: 20, color: '444444' }),
      ],
      spacing: { after: 60 },
    }),
  ]
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!['ADMIN', 'SECRETARY'].includes(profile.role) && !profile.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      recorder: { select: { fullName: true } },
      agendaItems: { orderBy: { position: 'asc' } },
      actionPoints: { include: { owner: { select: { fullName: true } } } },
      decisions: { orderBy: { decidedAt: 'asc' } },
      attendanceRecords: ATTENDANCE_RECORDS_INCLUDE,
    },
  })
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'ALUBONETS SHG', bold: true, size: 36, color: '001f50' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Meeting Minutes', size: 24, color: '888888' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: meeting.title, bold: true, size: 32, color: '001f50' })],
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.THICK, size: 8, color: 'fe8015', space: 4 } },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: meeting.status === 'FINAL' ? 'FINAL  ' : 'DRAFT  ',
          bold: true,
          size: 18,
          color: meeting.status === 'FINAL' ? '001f50' : 'fe8015',
        }),
        new TextRun({ text: '·  ' + fmtDate(meeting.heldAt), size: 18, color: '666666' }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Total present: ', bold: true, size: 18, color: '001f50' }),
        new TextRun({ text: String(meeting.attendance), size: 18, bold: true, color: '333333' }),
      ],
      spacing: { after: 60 },
    }),
    ...(meeting.recorder
      ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'Recorded by: ', bold: true, size: 18, color: '001f50' }),
              new TextRun({ text: meeting.recorder.fullName, size: 18, color: '555555' }),
            ],
            spacing: { after: 160 },
          }),
        ]
      : [new Paragraph({ spacing: { after: 160 }, children: [] })]),
  ]

  if (meeting.opening?.trim()) {
    children.push(sectionHeading('Opening'), ...bodyPara(meeting.opening))
  }

  const attendance = attendanceLists(meeting)
  if (attendance.present || attendance.apology || attendance.absent) {
    const asList = (value: string) => value.split('\n').join(', ')
    children.push(
      sectionHeading('Attendance'),
      ...labelValue('Present', asList(attendance.present)),
      ...labelValue('Absent with apology', asList(attendance.apology)),
      ...labelValue('Absent', asList(attendance.absent)),
    )
  }

  if (meeting.agenda?.trim()) {
    children.push(sectionHeading('Agenda'), ...bodyPara(meeting.agenda))
  }
  if (meeting.agendaItems.length) {
    children.push(
      sectionHeading('Structured agenda items'),
      ...meeting.agendaItems.flatMap((item, i) =>
        bodyPara(`${i + 1}. ${item.title}${item.description ? ` — ${item.description}` : ''}`),
      ),
    )
  }
  if (meeting.minutes?.trim()) {
    children.push(sectionHeading('Discussion / Minutes'), ...bodyPara(meeting.minutes))
  }
  if (meeting.resolutions?.trim()) {
    children.push(sectionHeading('Resolutions (narrative)'), ...bodyPara(meeting.resolutions))
  }
  if (meeting.decisions.length) {
    children.push(
      sectionHeading('Decision register'),
      ...meeting.decisions.flatMap((d) =>
        bodyPara(`${d.reference}: ${d.title}\n${d.decision}\nDecided: ${fmtDate(d.decidedAt)}`),
      ),
    )
  }
  if (meeting.actionPoints.length) {
    children.push(
      sectionHeading('Action points'),
      ...meeting.actionPoints.flatMap((p) =>
        bodyPara(
          `• ${p.title} — ${p.owner.fullName} — ${p.status} — due ${
            p.dueAt ? fmtDate(p.dueAt) : 'No deadline'
          }${p.description ? `\n  ${p.description}` : ''}`,
        ),
      ),
    )
  }
  if (meeting.aob?.trim()) {
    children.push(sectionHeading('Any Other Business'), ...bodyPara(meeting.aob))
  }
  if (meeting.nextMeetingAt) {
    children.push(
      sectionHeading('Next Meeting'),
      new Paragraph({
        children: [new TextRun({ text: fmtDate(meeting.nextMeetingAt), size: 20, color: '333333' })],
        spacing: { after: 60 },
      }),
    )
  }

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    userId: profile.id,
    action: 'MEETING_EXPORT',
    entity: 'Meeting',
    entityId: meeting.id,
    meta: { format: 'docx', title: meeting.title },
  })

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 20, color: '222222' } } },
    },
    sections: [{ children }],
  })

  const buffer = await Packer.toBuffer(doc)
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const date = new Date(meeting.heldAt).toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="minutes-${slug}-${date}.docx"`,
    },
  })
}
