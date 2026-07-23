import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { SITE_LOGO } from '@/lib/constants'

// Module-level logo cache so warm lambda instances skip the network entirely
let _logoCache: { buf: ArrayBuffer; ct: string } | null = null

const BLUE   = rgb(0,     0.122, 0.314)   // #001f50
const BRIGHT = rgb(0.996, 0.502, 0.082)   // #fe8015
const ORANGE = rgb(0.592, 0.282, 0)       // #974800 — amounts on white
const WHITE  = rgb(1, 1, 1)
const GREY   = rgb(0.4,  0.4,  0.4)
const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50
const COL    = { date: 50, amount: 200, category: 340, end: 545 }

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const canView = profile.id === userId || profile.role === 'ADMIN' || profile.role === 'TREASURER'
  if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { fullName, email } = user

  const sp        = req.nextUrl.searchParams
  const startStr  = sp.get('startDate') ?? ''
  const endStr    = sp.get('endDate')   ?? ''
  const startDate = startStr ? new Date(startStr + 'T00:00:00') : undefined
  const endDate   = endStr   ? new Date(endStr   + 'T23:59:59') : undefined

  const contributions = await prisma.contribution.findMany({
    where: {
      userId,
      ...(startDate || endDate
        ? { paidAt: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
        : {}),
    },
    orderBy: { paidAt: 'desc' },
  })

  const total = contributions.reduce((s, c) => s + c.amount, 0)

  const periodLabel =
    startStr && endStr   ? `${startStr} to ${endStr}` :
    startStr             ? `From ${startStr}` :
    endStr               ? `Up to ${endStr}` :
                           'All time'

  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Fetch and embed logo once — shared across all pages
  let logo: PDFImage | null = null
  try {
    if (!_logoCache) {
      const res = await fetch(SITE_LOGO, { next: { revalidate: 86400 } } as RequestInit)
      if (res.ok) {
        _logoCache = { buf: await res.arrayBuffer(), ct: res.headers.get('content-type') ?? '' }
      }
    }
    if (_logoCache) {
      const { buf, ct } = _logoCache
      // Slice to pass a copy — pdf-lib takes ownership of the bytes it receives
      logo = ct.includes('png') ? await pdf.embedPng(buf.slice(0)) : await pdf.embedJpg(buf.slice(0))
    }
  } catch { /* fall back to text badge */ }

  function addPage() {
    const pg = pdf.addPage([PAGE_W, PAGE_H])

    // Header bar
    pg.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: BLUE })

    // Logo image or text badge fallback
    if (logo) {
      const dims = logo.scaleToFit(34, 34)
      pg.drawImage(logo, { x: 50, y: PAGE_H - 52, width: dims.width, height: dims.height })
    } else {
      pg.drawEllipse({ x: 66, y: PAGE_H - 35, xScale: 15, yScale: 15, color: BRIGHT })
      pg.drawText('A', { x: 61, y: PAGE_H - 41, size: 15, font: bold, color: WHITE })
    }

    pg.drawText('Alubonets SHG', { x: 92, y: PAGE_H - 30, size: 14, font: bold, color: WHITE })
    pg.drawText('Member Contribution Statement', { x: 92, y: PAGE_H - 48, size: 9, font, color: rgb(0.7, 0.8, 1) })
    // Orange accent stripe
    pg.drawRectangle({ x: 0, y: PAGE_H - 73, width: PAGE_W, height: 3, color: BRIGHT })

    // Member info (starts below stripe at PAGE_H-73)
    pg.drawText(fullName,  { x: MARGIN, y: PAGE_H - 92,  size: 12, font: bold,  color: BLUE })
    pg.drawText(email,     { x: MARGIN, y: PAGE_H - 108, size: 9, font, color: GREY })
    pg.drawText(`Period: ${periodLabel}`, { x: MARGIN, y: PAGE_H - 122, size: 9, font, color: GREY })

    // Total (right-aligned, orange)
    pg.drawText(`Total: KES ${Math.round(total).toLocaleString()}`,
      { x: COL.end - 110, y: PAGE_H - 102, size: 13, font: bold, color: ORANGE })

    // Column headers
    const hY = PAGE_H - 150
    pg.drawRectangle({ x: MARGIN, y: hY - 4, width: PAGE_W - 2 * MARGIN, height: 18, color: rgb(0.93, 0.95, 0.99) })
    pg.drawText('Date',     { x: COL.date,     y: hY, size: 9, font: bold, color: BLUE })
    pg.drawText('Amount',   { x: COL.amount,   y: hY, size: 9, font: bold, color: BLUE })
    pg.drawText('Category', { x: COL.category, y: hY, size: 9, font: bold, color: BLUE })

    return { pg, rowY: hY - 22 }
  }

  let { pg, rowY } = addPage()
  let pageNum = 1

  for (let idx = 0; idx < contributions.length; idx++) {
    if (rowY < 60) {
      // Footer on current page
      pg.drawText(`Page ${pageNum}`, { x: PAGE_W / 2 - 15, y: 30, size: 8, font, color: GREY })
      pageNum++
      ;({ pg, rowY } = addPage())
    }

    const c    = contributions[idx]
    const even = idx % 2 === 0
    if (even) {
      pg.drawRectangle({ x: MARGIN, y: rowY - 4, width: PAGE_W - 2 * MARGIN, height: 16, color: rgb(0.97, 0.97, 0.98) })
    }

    pg.drawText(
      new Date(c.paidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }),
      { x: COL.date, y: rowY, size: 9, font, color: rgb(0.2, 0.2, 0.2) },
    )
    pg.drawText(`KES ${Math.round(c.amount).toLocaleString()}`,
      { x: COL.amount, y: rowY, size: 9, font: bold, color: ORANGE },
    )
    pg.drawText(c.category || '—',
      { x: COL.category, y: rowY, size: 9, font, color: rgb(0.2, 0.2, 0.2) },
    )

    rowY -= 18
  }

  // Final footer
  pg.drawText(`Page ${pageNum}`, { x: PAGE_W / 2 - 15, y: 30, size: 8, font, color: GREY })
  pg.drawText(`Generated ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    { x: MARGIN, y: 30, size: 8, font, color: GREY },
  )

  const bytes = await pdf.save()
  const slug  = startStr || endStr ? `${startStr || 'start'}_to_${endStr || 'end'}` : 'all'
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="statement-${slug}.pdf"`,
      'Cache-Control': 'private, max-age=60, must-revalidate',
    },
  })
}
