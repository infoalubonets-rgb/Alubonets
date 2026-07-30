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
    include: { recorder: { select: { fullName: true } } },
  })
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const children: Paragraph[] = [
    // Header
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
    // Meeting title
    new Paragraph({
      children: [new TextRun({ text: meeting.title, bold: true, size: 32, color: '001f50' })],
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.THICK, size: 8, color: 'fe8015', space: 4 } },
    }),
    // Status + date
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
    // Attendance summary
    new Paragraph({
      children: [
        new TextRun({ text: 'Total present: ', bold: true, size: 18, color: '001f50' }),
        new TextRun({ text: String(meeting.attendance), size: 18, bold: true, color: '333333' }),
      ],
      spacing: { after: 60 },
    }),
    // Recorder
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

  const hasAttendance = meeting.attendees || meeting.membersApology || meeting.membersAbsent
  if (hasAttendance) {
    children.push(
      sectionHeading('Attendance'),
      ...labelValue('Present', meeting.attendees),
      ...labelValue('Absent with apology', meeting.membersApology),
      ...labelValue('Absent', meeting.membersAbsent),
    )
  }

  if (meeting.agenda?.trim()) {
    children.push(sectionHeading('Agenda'), ...bodyPara(meeting.agenda))
  }
  if (meeting.minutes?.trim()) {
    children.push(sectionHeading('Discussion / Minutes'), ...bodyPara(meeting.minutes))
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
