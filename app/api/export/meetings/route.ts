import { NextResponse } from 'next/server'
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  SectionType,
  PageBreak,
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

function meetingSection(m: {
  title: string
  heldAt: Date
  status: string
  attendance: number
  opening: string | null
  attendees: string | null
  membersApology: string | null
  membersAbsent: string | null
  agenda: string | null
  minutes: string | null
  aob: string | null
  nextMeetingAt: Date | null
}) {
  const children: Paragraph[] = [
    // Meeting title
    new Paragraph({
      children: [new TextRun({ text: m.title, bold: true, size: 32, color: '001f50' })],
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.THICK, size: 8, color: 'fe8015', space: 4 } },
    }),
    // Status + date row
    new Paragraph({
      children: [
        new TextRun({
          text: m.status === 'FINAL' ? 'FINAL  ' : 'DRAFT  ',
          bold: true,
          size: 18,
          color: m.status === 'FINAL' ? '001f50' : 'fe8015',
        }),
        new TextRun({ text: '·  ' + fmtDate(m.heldAt), size: 18, color: '666666' }),
      ],
      spacing: { after: 60 },
    }),
    // Attendance summary
    new Paragraph({
      children: [
        new TextRun({ text: 'Total present: ', bold: true, size: 18, color: '001f50' }),
        new TextRun({ text: String(m.attendance), size: 18, bold: true, color: '333333' }),
      ],
      spacing: { after: 160 },
    }),
  ]

  if (m.opening?.trim()) {
    children.push(sectionHeading('Opening'), ...bodyPara(m.opening))
  }

  const hasAttendance = m.attendees || m.membersApology || m.membersAbsent
  if (hasAttendance) {
    children.push(
      sectionHeading('Attendance'),
      ...labelValue('Present', m.attendees),
      ...labelValue('Absent with apology', m.membersApology),
      ...labelValue('Absent', m.membersAbsent),
    )
  }

  if (m.agenda?.trim()) {
    children.push(sectionHeading('Agenda'), ...bodyPara(m.agenda))
  }
  if (m.minutes?.trim()) {
    children.push(sectionHeading('Discussion / Minutes'), ...bodyPara(m.minutes))
  }
  if (m.aob?.trim()) {
    children.push(sectionHeading('Any Other Business'), ...bodyPara(m.aob))
  }
  if (m.nextMeetingAt) {
    children.push(
      sectionHeading('Next Meeting'),
      new Paragraph({
        children: [new TextRun({ text: fmtDate(m.nextMeetingAt), size: 20, color: '333333' })],
        spacing: { after: 60 },
      }),
    )
  }

  return children
}

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!['ADMIN', 'SECRETARY'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const meetings = await prisma.meeting.findMany({ orderBy: { heldAt: 'desc' }, take: 50 })

  const coverSection = {
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: 'ALUBONETS SHG', bold: true, size: 52, color: '001f50' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Meeting Minutes', size: 28, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Exported ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
            size: 18,
            color: '999999',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  }

  const meetingSections = meetings.map((m, i) => ({
    properties: i > 0 ? { type: SectionType.NEXT_PAGE } : undefined,
    children: meetingSection(m),
  }))

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: '222222' } },
      },
    },
    sections: [coverSection, ...meetingSections],
  })

  const buffer = await Packer.toBuffer(doc)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="alubonets-meetings.docx"',
    },
  })
}
