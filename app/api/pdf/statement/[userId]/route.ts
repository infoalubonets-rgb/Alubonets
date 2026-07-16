import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const canView =
    profile.id === userId || profile.role === 'ADMIN' || profile.role === 'TREASURER'
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contributions = await prisma.contribution.findMany({
    where: { userId },
    orderBy: { paidAt: 'desc' },
  })
  const total = contributions.reduce((s, c) => s + c.amount, 0)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Alubonets SHG — Member Statement', {
    x: 50,
    y: 780,
    size: 16,
    font: bold,
    color: rgb(0, 0.12, 0.31),
  })
  page.drawText(`${user.fullName} (${user.email})`, { x: 50, y: 750, size: 12, font })
  page.drawText(`Total: KES ${total.toLocaleString()}`, { x: 50, y: 730, size: 12, font: bold })

  let y = 700
  for (const c of contributions.slice(0, 30)) {
    page.drawText(
      `${c.paidAt.toLocaleDateString()}  KES ${c.amount.toLocaleString()}  ${c.category || ''}`,
      { x: 50, y, size: 10, font }
    )
    y -= 18
    if (y < 60) break
  }

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="statement-${userId}.pdf"`,
    },
  })
}
