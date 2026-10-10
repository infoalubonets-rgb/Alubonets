import { NextRequest, NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { getActiveFinanceDestination } from '@/app/actions/finance'
import { buildPaymentDetailsPdf } from '@/lib/pdf/payment-details'

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const destination = await getActiveFinanceDestination()
  const bytes = await buildPaymentDetailsPdf(destination && { ...destination, updatedAt: destination.createdAt })
  const download = req.nextUrl.searchParams.get('download') === '1'
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="alubonets-payment-details.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
