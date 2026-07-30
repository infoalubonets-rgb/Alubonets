import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib'
import type { Meeting, User } from '@prisma/client'
import { SITE_LOGO } from '@/lib/constants'

export type MeetingForPdf = Meeting & {
  recorder?: Pick<User, 'fullName' | 'email'> | null
}

const PAGE_W = 595
const PAGE_H = 842
const MX     = 50          // horizontal margin
const MB     = 60          // bottom margin
const NAVY   = rgb(0,     0.122, 0.314)   // #001f50
const BRIGHT = rgb(0.996, 0.502, 0.082)   // #fe8015
const ORANGE = rgb(0.592, 0.282, 0)       // #974800
const WHITE  = rgb(1, 1, 1)
const DARK   = rgb(0.08, 0.08, 0.1)
const MUTED  = rgb(0.38, 0.40, 0.44)
const LGREY  = rgb(0.88, 0.88, 0.90)

// Module-level cache — warm lambda instances skip the CDN round-trip entirely
let _logoBuf: ArrayBuffer | null = null
let _logoCt  = ''

async function fetchLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    if (!_logoBuf) {
      const res = await fetch(SITE_LOGO, { next: { revalidate: 86400 } } as RequestInit)
      if (!res.ok) return null
      _logoBuf = await res.arrayBuffer()
      _logoCt  = res.headers.get('content-type') ?? ''
    }
    return _logoCt.includes('png')
      ? await pdf.embedPng(_logoBuf.slice(0))
      : await pdf.embedJpg(_logoBuf.slice(0))
  } catch { return null }
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!para.trim()) { lines.push(''); continue }
    let cur = ''
    for (const word of para.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxW) { cur = next }
      else { if (cur) lines.push(cur); cur = word }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

type Ctx = { pdf: PDFDocument; page: PDFPage; font: PDFFont; bold: PDFFont; y: number; logo: PDFImage | null }

function addPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  // Repeat mini header on continuation pages
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: NAVY })
  ctx.page.drawText('ALUBONETS SHG — MEETING MINUTES (cont.)', {
    x: MX, y: PAGE_H - 18, size: 8, font: ctx.bold, color: WHITE,
  })
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 31, width: PAGE_W, height: 3, color: BRIGHT })
  ctx.y = PAGE_H - 52
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MB) addPage(ctx)
}

function drawSection(ctx: Ctx, title: string, body?: string | null) {
  if (!body?.trim()) return
  ensureSpace(ctx, 44)

  // Section title bar
  ctx.page.drawRectangle({ x: MX, y: ctx.y - 2, width: 3, height: 14, color: BRIGHT })
  ctx.page.drawText(title.toUpperCase(), {
    x: MX + 9, y: ctx.y, size: 9, font: ctx.bold, color: NAVY,
  })
  ctx.y -= 18

  const lines = wrapText(body.trim(), ctx.font, 10, PAGE_W - MX * 2)
  for (const line of lines) {
    ensureSpace(ctx, 14)
    if (line) {
      ctx.page.drawText(line, { x: MX, y: ctx.y, size: 10, font: ctx.font, color: DARK })
    }
    ctx.y -= 13
  }
  ctx.y -= 10
}

function drawAttendanceRow(ctx: Ctx, label: string, value: string | null | undefined, color = DARK) {
  if (!value?.trim()) return
  ensureSpace(ctx, 14)
  ctx.page.drawText(`${label}:`, { x: MX, y: ctx.y, size: 9, font: ctx.bold, color: NAVY })
  const lines = wrapText(value.trim(), ctx.font, 9, PAGE_W - MX * 2 - 95)
  ctx.page.drawText(lines[0] ?? '', { x: MX + 95, y: ctx.y, size: 9, font: ctx.font, color })
  ctx.y -= 13
  for (let i = 1; i < lines.length; i++) {
    ensureSpace(ctx, 13)
    ctx.page.drawText(lines[i], { x: MX + 95, y: ctx.y, size: 9, font: ctx.font, color })
    ctx.y -= 13
  }
}

export async function buildMeetingMinutesPdf(meeting: MeetingForPdf): Promise<Uint8Array> {
  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await fetchLogo(pdf)

  const page = pdf.addPage([PAGE_W, PAGE_H])
  const ctx: Ctx = { pdf, page, font, bold, y: 0, logo }

  // ── Header bar ────────────────────────────────────────────────────────────
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: NAVY })

  if (logo) {
    const dims = logo.scaleToFit(34, 34)
    ctx.page.drawImage(logo, { x: MX, y: PAGE_H - 52, width: dims.width, height: dims.height })
  } else {
    ctx.page.drawEllipse({ x: MX + 16, y: PAGE_H - 35, xScale: 15, yScale: 15, color: BRIGHT })
    ctx.page.drawText('A', { x: MX + 11, y: PAGE_H - 41, size: 15, font: bold, color: WHITE })
  }

  ctx.page.drawText('Alubonets SHG', { x: MX + 42, y: PAGE_H - 30, size: 14, font: bold, color: WHITE })
  ctx.page.drawText('Meeting Minutes', { x: MX + 42, y: PAGE_H - 48, size: 9, font, color: rgb(0.7, 0.8, 1) })

  // Orange accent stripe
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 73, width: PAGE_W, height: 3, color: BRIGHT })

  // ── Meeting title block ────────────────────────────────────────────────────
  ctx.y = PAGE_H - 98
  ctx.page.drawText(meeting.title, { x: MX, y: ctx.y, size: 16, font: bold, color: NAVY })
  ctx.y -= 22

  // Status pill
  const statusLabel = meeting.status === 'FINAL' ? 'FINAL' : 'DRAFT'
  ctx.page.drawRectangle({
    x: MX, y: ctx.y - 3, width: 42, height: 14,
    color: meeting.status === 'FINAL' ? NAVY : rgb(0.88, 0.88, 0.9),
  })
  ctx.page.drawText(statusLabel, {
    x: MX + 4, y: ctx.y, size: 8, font: bold,
    color: meeting.status === 'FINAL' ? WHITE : MUTED,
  })

  // Meta line
  const dateLine = meeting.heldAt.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeLine = meeting.heldAt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  ctx.page.drawText(`${dateLine}, ${timeLine}`, { x: MX + 52, y: ctx.y, size: 9, font, color: MUTED })
  ctx.y -= 16

  if (meeting.recorder) {
    ctx.page.drawText(`Recorded by: ${meeting.recorder.fullName}`, { x: MX, y: ctx.y, size: 9, font, color: MUTED })
    ctx.y -= 14
  }

  // ── Attendance summary ─────────────────────────────────────────────────────
  ctx.y -= 6
  ctx.page.drawRectangle({
    x: MX, y: ctx.y - 4, width: PAGE_W - MX * 2, height: 18,
    color: rgb(0.95, 0.96, 0.99),
  })
  ctx.page.drawText(`Total present: ${meeting.attendance}`, {
    x: MX + 8, y: ctx.y + 1, size: 9, font: bold, color: NAVY,
  })
  ctx.y -= 20

  // ── Divider ───────────────────────────────────────────────────────────────
  ctx.page.drawRectangle({ x: MX, y: ctx.y, width: PAGE_W - MX * 2, height: 1.5, color: BRIGHT })
  ctx.y -= 18

  // ── Attendance section ────────────────────────────────────────────────────
  const hasAttendance = meeting.attendees || meeting.membersApology || meeting.membersAbsent
  if (hasAttendance) {
    ensureSpace(ctx, 44)
    ctx.page.drawRectangle({ x: MX, y: ctx.y - 2, width: 3, height: 14, color: BRIGHT })
    ctx.page.drawText('ATTENDANCE', { x: MX + 9, y: ctx.y, size: 9, font: bold, color: NAVY })
    ctx.y -= 18

    drawAttendanceRow(ctx, 'Present', meeting.attendees, DARK)
    drawAttendanceRow(ctx, 'Absent with apology', meeting.membersApology, MUTED)
    drawAttendanceRow(ctx, 'Absent', meeting.membersAbsent, MUTED)
    ctx.y -= 6
  }

  // ── Main sections ─────────────────────────────────────────────────────────
  drawSection(ctx, 'Opening', meeting.opening)
  drawSection(ctx, 'Agenda', meeting.agenda)
  drawSection(ctx, 'Discussion / Minutes', meeting.minutes)
  drawSection(ctx, 'Any Other Business (AOB)', meeting.aob)

  if (meeting.nextMeetingAt) {
    const next = new Date(meeting.nextMeetingAt)
    drawSection(
      ctx,
      'Next Meeting',
      next.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ', ' +
        next.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    )
  }

  // ── End marker ────────────────────────────────────────────────────────────
  ensureSpace(ctx, 50)
  ctx.y -= 8
  ctx.page.drawRectangle({ x: MX, y: ctx.y, width: PAGE_W - MX * 2, height: 0.5, color: LGREY })
  ctx.y -= 14
  ctx.page.drawText('— End of minutes —', { x: MX, y: ctx.y, size: 9, font: bold, color: MUTED })
  ctx.y -= 10
  const signDate = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.page.drawText(`Generated ${signDate}`, { x: MX, y: ctx.y, size: 8, font, color: rgb(0.7, 0.7, 0.7) })

  // Page numbers
  const pages = pdf.getPages()
  pages.forEach((pg, i) => {
    pg.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: PAGE_W - MX - 60, y: 28, size: 8, font, color: MUTED,
    })
    pg.drawText('Alubonets Self-Help Group', { x: MX, y: 28, size: 8, font, color: MUTED })
  })

  return pdf.save()
}

export function minutesFilename(meeting: Pick<Meeting, 'id' | 'title' | 'heldAt'>) {
  const date = new Date(meeting.heldAt).toISOString().slice(0, 10)
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `minutes-${slug || meeting.id}-${date}.pdf`
}
