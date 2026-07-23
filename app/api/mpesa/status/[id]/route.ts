import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

type LogRow = { action: string; meta: Record<string, unknown> | null }

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ status: 'error' }, { status: 401 })

  const { id: checkoutRequestId } = await context.params
  if (!checkoutRequestId) return NextResponse.json({ status: 'pending' })

  const rows = await prisma.$queryRaw<LogRow[]>`
    SELECT action, meta
    FROM audit_logs
    WHERE action IN ('MPESA_STK_FAILED', 'MPESA_STK_SUCCESS')
      AND meta->>'checkoutRequestId' = ${checkoutRequestId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `

  const row = rows[0]
  if (!row) return NextResponse.json({ status: 'pending' })

  const meta = row.meta ?? {}
  if (row.action === 'MPESA_STK_SUCCESS') {
    return NextResponse.json({ status: 'success', amount: meta.amount, receipt: meta.receipt })
  }
  return NextResponse.json({ status: 'failed', resultCode: meta.resultCode, resultDesc: meta.resultDesc })
}
