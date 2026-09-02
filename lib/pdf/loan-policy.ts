import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib'
import { SITE_LOGO } from '@/lib/constants'

export type LoanPolicyDocument = {
  title: string
  content: string
  effectiveDate: string
}

const PAGE_W = 595
const PAGE_H = 842
const MX     = 50
const MB     = 60
const NAVY   = rgb(0,     0.122, 0.314)
const BRIGHT = rgb(0.996, 0.502, 0.082)
const WHITE  = rgb(1, 1, 1)
const DARK   = rgb(0.08, 0.08, 0.1)
const MUTED  = rgb(0.38, 0.40, 0.44)
const LGREY  = rgb(0.88, 0.88, 0.90)

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

type Ctx = { pdf: PDFDocument; page: PDFPage; font: PDFFont; bold: PDFFont; y: number }

function addPage(ctx: Ctx, title: string) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: NAVY })
  ctx.page.drawText(`ALUBONETS SHG — ${title.toUpperCase()} (cont.)`, {
    x: MX, y: PAGE_H - 18, size: 8, font: ctx.bold, color: WHITE,
  })
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 31, width: PAGE_W, height: 3, color: BRIGHT })
  ctx.y = PAGE_H - 52
}

function ensureSpace(ctx: Ctx, needed: number, title: string) {
  if (ctx.y - needed < MB) addPage(ctx, title)
}

export async function buildLoanPolicyPdf(policy: LoanPolicyDocument): Promise<Uint8Array> {
  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await fetchLogo(pdf)

  const page = pdf.addPage([PAGE_W, PAGE_H])
  const ctx: Ctx = { pdf, page, font, bold, y: 0 }

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
  ctx.page.drawText('Loan Policy', { x: MX + 42, y: PAGE_H - 48, size: 9, font, color: rgb(0.7, 0.8, 1) })

  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 73, width: PAGE_W, height: 3, color: BRIGHT })

  // ── Title block ───────────────────────────────────────────────────────────
  ctx.y = PAGE_H - 98
  const titleLines = wrapText(policy.title, bold, 16, PAGE_W - MX * 2)
  for (const line of titleLines) {
    ctx.page.drawText(line, { x: MX, y: ctx.y, size: 16, font: bold, color: NAVY })
    ctx.y -= 20
  }

  if (policy.effectiveDate) {
    const formatted = new Date(policy.effectiveDate + 'T00:00:00').toLocaleDateString('en-KE', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    ctx.page.drawText(`Effective ${formatted}`, { x: MX, y: ctx.y, size: 9, font, color: MUTED })
    ctx.y -= 16
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  ctx.y -= 4
  ctx.page.drawRectangle({ x: MX, y: ctx.y, width: PAGE_W - MX * 2, height: 1.5, color: BRIGHT })
  ctx.y -= 20

  // ── Content ───────────────────────────────────────────────────────────────
  const lines = wrapText(policy.content.trim() || 'No policy content has been added yet.', font, 10.5, PAGE_W - MX * 2)
  for (const line of lines) {
    ensureSpace(ctx, 16, policy.title)
    if (line) {
      ctx.page.drawText(line, { x: MX, y: ctx.y, size: 10.5, font, color: DARK })
    }
    ctx.y -= 15
  }

  // ── End marker ────────────────────────────────────────────────────────────
  ensureSpace(ctx, 50, policy.title)
  ctx.y -= 8
  ctx.page.drawRectangle({ x: MX, y: ctx.y, width: PAGE_W - MX * 2, height: 0.5, color: LGREY })
  ctx.y -= 14
  ctx.page.drawText('— End of policy —', { x: MX, y: ctx.y, size: 9, font: bold, color: MUTED })
  ctx.y -= 10
  const generated = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.page.drawText(`Generated ${generated}`, { x: MX, y: ctx.y, size: 8, font, color: rgb(0.7, 0.7, 0.7) })

  // Page numbers + footer
  const pages = pdf.getPages()
  pages.forEach((pg, i) => {
    pg.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE_W - MX - 60, y: 28, size: 8, font, color: MUTED })
    pg.drawText('Alubonets Self-Help Group', { x: MX, y: 28, size: 8, font, color: MUTED })
  })

  return pdf.save()
}

export function loanPolicyFilename(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${slug || 'loan-policy'}.pdf`
}
