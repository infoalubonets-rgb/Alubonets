import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sendContributionNotificationToTreasurers } from '@/lib/email/resend'

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
  amount?: number
  phone?: string
}

async function findStkInit(checkoutRequestId: string) {
  try {
    const matched = await prisma.$queryRaw<Array<{ userId: string; meta: StkMeta | null }>>`
      SELECT "userId", meta
      FROM audit_logs
      WHERE action = 'MPESA_STK_INIT'
        AND meta->>'checkoutRequestId' = ${checkoutRequestId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `
    if (matched[0]) return matched[0]

    const recent = await prisma.auditLog.findMany({
      where: { action: 'MPESA_STK_INIT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const audit = recent.find((row) => {
      if (!row.meta || typeof row.meta !== 'object' || Array.isArray(row.meta)) return false
      return (row.meta as Prisma.JsonObject).checkoutRequestId === checkoutRequestId
    })
    if (!audit) return null
    return { userId: audit.userId, meta: audit.meta as StkMeta | null }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CallbackBody
  const cb = body.Body?.stkCallback
  if (!cb) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

  const checkoutRequestId = cb.CheckoutRequestID

  // Look up the initiating STK for userId + meta (phone, amount)
  const stkInit = checkoutRequestId ? await findStkInit(checkoutRequestId) : null
  const initiatorUserId = stkInit?.userId
  const stkMeta = stkInit?.meta
  const targetUserId = stkMeta?.targetUserId || initiatorUserId

  // Handle failure — save to audit log so treasurer can inspect
  if (cb.ResultCode !== 0) {
    if (initiatorUserId) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: initiatorUserId,
            action: 'MPESA_STK_FAILED',
            entity: 'Contribution',
            meta: {
              checkoutRequestId,
              merchantRequestId: cb.MerchantRequestID,
              resultCode: cb.ResultCode,
              resultDesc: cb.ResultDesc,
              targetUserId,
              phone: stkMeta?.phone ?? '',
              amount: stkMeta?.amount ?? 0,
            },
          },
        })
      } catch (e) {
        console.error('Failed to save STK failure log', e)
      }
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  // Successful payment
  const items = cb.CallbackMetadata?.Item || []
  const amount = Number(items.find((i) => i.Name === 'Amount')?.Value || 0)
  const receipt = String(items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || '')
  const phone = String(items.find((i) => i.Name === 'PhoneNumber')?.Value || '')

  if (receipt) {
    const existing = await prisma.contribution.findFirst({ where: { mpesaRef: receipt } })
    if (existing) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
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
    // Save success log so the status-polling endpoint can confirm to the client
    try {
      await prisma.auditLog.create({
        data: {
          userId: targetUserId,
          action: 'MPESA_STK_SUCCESS',
          entity: 'Contribution',
          meta: { checkoutRequestId, amount, receipt, phone },
        },
      })
    } catch { /* non-fatal */ }
    revalidateTag('contributions')

    // Notify treasurers by email (best-effort, non-blocking)
    try {
      const member = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { fullName: true },
      })
      await sendContributionNotificationToTreasurers({
        memberName: member?.fullName ?? 'A member',
        amount,
        receipt,
        phone,
      })
    } catch { /* non-fatal */ }
  } else if (amount > 0) {
    console.error('M-Pesa callback: paid but no matching STK init audit', {
      checkoutRequestId,
      receipt,
      amount,
    })
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
