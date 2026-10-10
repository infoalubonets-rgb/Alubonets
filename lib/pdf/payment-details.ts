import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import { SITE_LOGO } from '@/lib/constants'

export type PaymentDetails = {
  bankName: string
  accountName: string
  accountNumber: string
  paybillOrTill: string | null
  branchName: string | null
  mpesaType: string | null
  mpesaNumber: string | null
  mpesaAccount: string | null
  mpesaName: string | null
  notes: string | null
  updatedAt: Date
}

const PAGE_W = 595
const PAGE_H = 842
const MX     = 50
const NAVY   = rgb(0,     0.122, 0.314)
const BRIGHT = rgb(0.996, 0.502, 0.082)
const WHITE  = rgb(1, 1, 1)
const DARK   = rgb(0.08, 0.08, 0.1)
const MUTED  = rgb(0.38, 0.40, 0.44)
const PANEL  = rgb(0.95, 0.96, 0.99)

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

export async function buildPaymentDetailsPdf(details: PaymentDetails | null): Promise<Uint8Array> {
  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await fetchLogo(pdf)
  const page = pdf.addPage([PAGE_W, PAGE_H])

  page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: NAVY })
  if (logo) {
    const dims = logo.scaleToFit(34, 34)
    page.drawImage(logo, { x: MX, y: PAGE_H - 52, width: dims.width, height: dims.height })
  } else {
    page.drawEllipse({ x: MX + 16, y: PAGE_H - 35, xScale: 15, yScale: 15, color: BRIGHT })
    page.drawText('A', { x: MX + 11, y: PAGE_H - 41, size: 15, font: bold, color: WHITE })
  }
  page.drawText('Alubonets SHG', { x: MX + 42, y: PAGE_H - 30, size: 14, font: bold, color: WHITE })
  page.drawText('Official Payment Details', { x: MX + 42, y: PAGE_H - 48, size: 9, font, color: rgb(0.7, 0.8, 1) })
  page.drawRectangle({ x: 0, y: PAGE_H - 73, width: PAGE_W, height: 3, color: BRIGHT })

  let y = PAGE_H - 108
  page.drawText('How to pay your contributions', { x: MX, y, size: 16, font: bold, color: NAVY })
  y -= 18
  page.drawText('Use only these official details. Always include your name or membership number as the reference.', {
    x: MX, y, size: 9, font, color: MUTED,
  })
  y -= 14
  page.drawRectangle({ x: MX, y, width: PAGE_W - MX * 2, height: 1.5, color: BRIGHT })
  y -= 30

  const hasBank = Boolean(details?.bankName && details.accountNumber)
  const hasMpesa = Boolean(details?.mpesaNumber)
  if (!details || (!hasBank && !hasMpesa)) {
    page.drawText('Official payment details have not been published yet. Please contact the Treasurer or Admin.', {
      x: MX, y, size: 11, font, color: DARK,
    })
  } else {
    const drawPanel = (title: string, rows: [string, string | null | undefined][]) => {
      const shown = rows.filter((row): row is [string, string] => Boolean(row[1]))
      page.drawText(title, { x: MX, y, size: 12, font: bold, color: BRIGHT })
      y -= 24
      const rowH = 34
      page.drawRectangle({ x: MX, y: y - shown.length * rowH + 22, width: PAGE_W - MX * 2, height: shown.length * rowH + 4, color: PANEL })
      for (const [label, value] of shown) {
        page.drawText(label.toUpperCase(), { x: MX + 14, y, size: 8, font: bold, color: MUTED })
        page.drawText(value, { x: MX + 160, y: y - 2, size: 13, font: bold, color: NAVY })
        y -= rowH
      }
      y -= 16
    }
    if (hasMpesa) {
      const isPaybill = details.mpesaType === 'PAYBILL'
      drawPanel(isPaybill ? 'M-Pesa Paybill' : 'M-Pesa Till (Buy Goods)', [
        [isPaybill ? 'Paybill number' : 'Till number', details.mpesaNumber],
        ['Account number', isPaybill ? details.mpesaAccount : null],
        ['Business name', details.mpesaName],
      ])
    }
    if (hasBank) {
      drawPanel('Bank account', [
        ['Bank', details.bankName],
        ['Account name', details.accountName],
        ['Account number', details.accountNumber],
        ['Bank paybill', details.paybillOrTill],
        ['Branch', details.branchName],
      ])
    }
    if (details.notes) {
      page.drawText('NOTES', { x: MX, y, size: 8, font: bold, color: MUTED })
      y -= 15
      for (const line of wrap(details.notes, font, 10.5, PAGE_W - MX * 2)) {
        page.drawText(line, { x: MX, y, size: 10.5, font, color: DARK })
        y -= 15
      }
    }
    y -= 10
    const updated = details.updatedAt.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
    page.drawText(`Details last updated ${updated}`, { x: MX, y, size: 8, font, color: MUTED })
  }

  const generated = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  page.drawText('Alubonets Self-Help Group', { x: MX, y: 28, size: 8, font, color: MUTED })
  page.drawText(`Generated ${generated}`, { x: PAGE_W - MX - 110, y: 28, size: 8, font, color: MUTED })
  return pdf.save()
}

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxW: number) {
  const lines: string[] = []
  for (const para of text.replace(/\r\n/g, '\n').split('\n')) {
    let cur = ''
    for (const word of para.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxW) cur = next
      else { if (cur) lines.push(cur); cur = word }
    }
    lines.push(cur)
  }
  return lines
}
