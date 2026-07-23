import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Contribution, User } from '@prisma/client'
import { SITE_LOGO } from '@/lib/constants'

const NAVY   = rgb(0,     0.122, 0.314)
const ORANGE = rgb(0.592, 0.282, 0)
const BRIGHT = rgb(0.996, 0.502, 0.082)
const WHITE  = rgb(1, 1, 1)
const DARK   = rgb(0.1,  0.1,  0.1)
const GREY   = rgb(0.44, 0.44, 0.44)
const LGREY  = rgb(0.88, 0.88, 0.9)
const BGCARD = rgb(0.975, 0.977, 0.985)

const W = 595, H = 842, M = 50

// Module-level cache: warm lambda instances skip the network entirely.
// Cold starts still use Next.js data cache (revalidate 24h) before hitting the CDN.
let _logoBuf: ArrayBuffer | null = null
let _logoCt  = ''

async function fetchLogo(pdf: PDFDocument) {
  try {
    if (!_logoBuf) {
      const res = await fetch(SITE_LOGO, { next: { revalidate: 86400 } } as RequestInit)
      if (!res.ok) return null
      _logoBuf = await res.arrayBuffer()
      _logoCt  = res.headers.get('content-type') ?? ''
    }
    // Slice to pass a copy — pdf-lib takes ownership of the bytes it receives
    return _logoCt.includes('png')
      ? await pdf.embedPng(_logoBuf.slice(0))
      : await pdf.embedJpg(_logoBuf.slice(0))
  } catch { return null }
}

export async function buildReceiptPdf(
  c: Contribution & { user: User }
): Promise<Uint8Array> {
  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await fetchLogo(pdf)
  const page = pdf.addPage([W, H])

  // ── Header bar ──────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: NAVY })

  // Logo image (or orange "A" badge fallback)
  if (logo) {
    const dims = logo.scaleToFit(34, 34)
    page.drawImage(logo, { x: 50, y: H - 52, width: dims.width, height: dims.height })
  } else {
    page.drawEllipse({ x: 66, y: H - 35, xScale: 15, yScale: 15, color: BRIGHT })
    page.drawText('A', { x: 61, y: H - 41, size: 15, font: bold, color: WHITE })
  }

  // Org name + subtitle
  page.drawText('Alubonets SHG', { x: 92, y: H - 29, size: 14, font: bold, color: WHITE })
  page.drawText('Contribution Receipt', { x: 92, y: H - 47, size: 9, font, color: rgb(0.7, 0.8, 1) })

  // Orange accent stripe
  page.drawRectangle({ x: 0, y: H - 73, width: W, height: 3, color: BRIGHT })

  // ── Receipt label ────────────────────────────────────────
  page.drawText('PAYMENT RECEIPT', { x: M, y: H - 105, size: 10, font: bold, color: ORANGE })
  page.drawRectangle({ x: M, y: H - 112, width: W - 2 * M, height: 0.5, color: LGREY })

  // ── Big amount ───────────────────────────────────────────
  const amtStr = `KES ${Math.round(c.amount).toLocaleString()}`
  page.drawText(amtStr, { x: M, y: H - 150, size: 26, font: bold, color: ORANGE })
  page.drawText('amount received', { x: M, y: H - 168, size: 8, font, color: GREY })

  // ── Details card ─────────────────────────────────────────
  const fields: [string, string][] = [
    ['Member',    c.user.fullName],
    ['Email',     c.user.email],
    ['Date',      c.paidAt.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Method',    c.paymentMethod],
    ['Reference', c.mpesaRef || c.id],
    ...(c.category    ? [['Category', c.category] as [string, string]]    : []),
    ...(c.description ? [['Notes',    c.description] as [string, string]] : []),
  ]

  const ROW   = 26
  const cardH = fields.length * ROW + 20
  const cardY = H - 200

  page.drawRectangle({ x: M, y: cardY - cardH, width: W - 2 * M, height: cardH, color: BGCARD, borderColor: LGREY, borderWidth: 0.5 })

  fields.forEach(([label, value], i) => {
    const y = cardY - 14 - i * ROW
    page.drawText(label.toUpperCase(), { x: M + 14, y, size: 7.5, font: bold, color: GREY })
    page.drawText(value,               { x: M + 120, y, size: 9,   font,       color: DARK })
    if (i < fields.length - 1) {
      page.drawRectangle({ x: M + 14, y: y - 8, width: W - 2 * M - 28, height: 0.3, color: rgb(0.9, 0.9, 0.9) })
    }
  })

  // ── Footer ───────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: 42, color: rgb(0.97, 0.97, 0.98) })
  page.drawRectangle({ x: 0, y: 42, width: W, height: 0.5, color: LGREY })
  page.drawText('Alubonets Self-Help Group', { x: M, y: 26, size: 8, font: bold, color: GREY })
  page.drawText(
    `Generated ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    { x: W - M - 90, y: 26, size: 8, font, color: GREY },
  )
  page.drawText('This is an official contribution receipt.', {
    x: M, y: 11, size: 7, font, color: rgb(0.65, 0.65, 0.65),
  })

  return pdf.save()
}
