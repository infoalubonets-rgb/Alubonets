import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ status: 'error' }, { status: 401 })

  const { id: checkoutRequestId } = await context.params

  const [failed, succeeded] = await Promise.all([
    prisma.auditLog.findFirst({
      where: {
        action: 'MPESA_STK_FAILED',
        meta: { path: ['checkoutRequestId'], equals: checkoutRequestId },
      },
    }),
    prisma.auditLog.findFirst({
      where: {
        action: 'MPESA_STK_SUCCESS',
        meta: { path: ['checkoutRequestId'], equals: checkoutRequestId },
      },
    }),
  ])

  if (failed) {
    const meta = failed.meta as { resultCode?: number; resultDesc?: string }
    return NextResponse.json({
      status: 'failed',
      resultCode: meta.resultCode,
      resultDesc: meta.resultDesc,
    })
  }

  if (succeeded) {
    const meta = succeeded.meta as { amount?: number; receipt?: string }
    return NextResponse.json({ status: 'success', amount: meta.amount, receipt: meta.receipt })
  }

  return NextResponse.json({ status: 'pending' })
}
