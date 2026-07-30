import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { buildReceiptPdf } from '@/lib/pdf/receipt'

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

  const bytes = await buildReceiptPdf(contribution)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${contribution.id}.pdf"`,
      'Cache-Control': 'private, max-age=3600, immutable',
    },
  })
}
