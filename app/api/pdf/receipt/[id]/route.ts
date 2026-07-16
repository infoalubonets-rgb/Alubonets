import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: { user: true },
  })
  if (!contribution) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canView =
    profile.role === 'ADMIN' ||
    profile.role === 'TREASURER' ||
    contribution.userId === profile.id
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Alubonets SHG — Contribution Receipt', {
    x: 50,
    y: 780,
    size: 16,
    font: bold,
    color: rgb(0, 0.12, 0.31),
  })
  page.drawText(`Member: ${contribution.user.fullName}`, { x: 50, y: 740, size: 12, font })
  page.drawText(`Email: ${contribution.user.email}`, { x: 50, y: 720, size: 12, font })
  page.drawText(`Amount: KES ${contribution.amount.toLocaleString()}`, {
    x: 50,
    y: 690,
    size: 12,
    font,
  })
  page.drawText(`Date: ${contribution.paidAt.toLocaleString()}`, { x: 50, y: 670, size: 12, font })
  page.drawText(`Method: ${contribution.paymentMethod}`, { x: 50, y: 650, size: 12, font })
  page.drawText(`Reference: ${contribution.mpesaRef || contribution.id}`, {
    x: 50,
    y: 630,
    size: 12,
    font,
  })
  if (contribution.description) {
    page.drawText(`Notes: ${contribution.description}`, { x: 50, y: 610, size: 12, font })
  }

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${contribution.id}.pdf"`,
    },
  })
}
