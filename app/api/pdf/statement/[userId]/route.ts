import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

const BLUE  = rgb(0, 0.12, 0.31)
const GREY  = rgb(0.4, 0.4, 0.4)
const GREEN = rgb(0, 0.47, 0.27)
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

  function addPage() {
    const pg = pdf.addPage([PAGE_W, PAGE_H])

    // Header bar
    pg.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: BLUE })
    pg.drawText('Alubonets SHG', { x: MARGIN, y: PAGE_H - 30, size: 16, font: bold, color: rgb(1, 1, 1) })
    pg.drawText('Member Contribution Statement', { x: MARGIN, y: PAGE_H - 50, size: 10, font, color: rgb(0.8, 0.85, 1) })

    // Member info
    pg.drawText(user.fullName,  { x: MARGIN, y: PAGE_H - 90,  size: 12, font: bold,  color: BLUE })
    pg.drawText(user.email,     { x: MARGIN, y: PAGE_H - 106, size: 9,  font,        color: GREY })
    pg.drawText(`Period: ${periodLabel}`, { x: MARGIN, y: PAGE_H - 120, size: 9, font, color: GREY })

    // Total
    pg.drawText(`Total: KES ${Math.round(total).toLocaleString()}`,
      { x: COL.end - 100, y: PAGE_H - 100, size: 13, font: bold, color: GREEN })

    // Column headers
    const hY = PAGE_H - 148
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
      { x: COL.amount, y: rowY, size: 9, font: bold, color: GREEN },
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
    },
  })
}
