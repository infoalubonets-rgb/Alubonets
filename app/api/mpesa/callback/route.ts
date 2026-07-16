import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type CallbackBody = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string
      CheckoutRequestID?: string
      ResultCode?: number
      ResultDesc?: string
      CallbackMetadata?: {
        Item?: Array<{ Name: string; Value?: string | number }>
      }
    }
  }
}

type StkMeta = {
  checkoutRequestId?: string
  targetUserId?: string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CallbackBody
  const cb = body.Body?.stkCallback
  if (!cb) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  if (cb.ResultCode !== 0) {
    console.warn('M-Pesa STK failed', cb.ResultDesc, cb.CheckoutRequestID)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const items = cb.CallbackMetadata?.Item || []
  const amount = Number(items.find((i) => i.Name === 'Amount')?.Value || 0)
  const receipt = String(items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || '')
  const phone = String(items.find((i) => i.Name === 'PhoneNumber')?.Value || '')
  const checkoutRequestId = cb.CheckoutRequestID

  if (receipt) {
    const existing = await prisma.contribution.findFirst({ where: { mpesaRef: receipt } })
    if (existing) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }
  }

  // Prefer Postgres JSON operator (reliable); fall back to recent in-memory match
  let targetUserId: string | undefined

  if (checkoutRequestId) {
    const matched = await prisma.$queryRaw<Array<{ userId: string; meta: StkMeta | null }>>`
      SELECT "userId", meta
      FROM audit_logs
      WHERE action = 'MPESA_STK_INIT'
        AND meta->>'checkoutRequestId' = ${checkoutRequestId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `

    if (matched[0]) {
      targetUserId = matched[0].meta?.targetUserId || matched[0].userId
    } else {
      const recent = await prisma.auditLog.findMany({
        where: { action: 'MPESA_STK_INIT' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      const audit = recent.find((row) => {
        if (!row.meta || typeof row.meta !== 'object' || Array.isArray(row.meta)) return false
        return (row.meta as Prisma.JsonObject).checkoutRequestId === checkoutRequestId
      })
      const meta = audit?.meta as StkMeta | null
      targetUserId = meta?.targetUserId || audit?.userId
    }
  }

  if (targetUserId && amount > 0) {
    await prisma.contribution.create({
      data: {
        userId: targetUserId,
        amount,
        description: `M-Pesa STK ${phone}`,
        category: 'M-Pesa',
        paymentMethod: 'MPESA',
        mpesaRef: receipt || checkoutRequestId || undefined,
      },
    })
  } else if (amount > 0) {
    console.error('M-Pesa callback: paid but no matching STK init audit', {
      checkoutRequestId,
      receipt,
      amount,
    })
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
