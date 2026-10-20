import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createLedgerContribution, getPeriodForDate } from '@/lib/finance'
import { mpesaCallbackTokenValid, stkQuery } from '@/lib/mpesa/daraja'

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
  categoryId?: string
  campaignId?: string | null
  projectId?: string | null
  contributionPeriod?: string | null
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

const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' }

/** True when this STK request has already been credited (a replayed or duplicate callback). */
async function alreadyCredited(checkoutRequestId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM audit_logs
    WHERE action = 'MPESA_STK_SUCCESS' AND meta->>'checkoutRequestId' = ${checkoutRequestId}
    LIMIT 1
  `
  return rows.length > 0
}

/**
 * Safaricom STK callback. The request itself is unauthenticated, so nothing in it is trusted
 * on its own: a payment is credited only when (1) it carries our secret token, (2) it matches
 * an STK request this site started, (3) Safaricom's STK Query confirms that request was paid,
 * and (4) it has not been credited before. The amount always comes from our own STK record.
 */
export async function POST(req: NextRequest) {
  if (!mpesaCallbackTokenValid(req.nextUrl.searchParams.get('token'))) {
    console.warn('M-Pesa callback rejected: missing or wrong token')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as CallbackBody
  const cb = body.Body?.stkCallback
  if (!cb) return NextResponse.json(ACCEPTED)

  const checkoutRequestId = cb.CheckoutRequestID

  // Look up the initiating STK for userId + meta (phone, amount)
  const stkInit = checkoutRequestId ? await findStkInit(checkoutRequestId) : null
  if (!checkoutRequestId || !stkInit) {
    console.warn('M-Pesa callback ignored: no matching STK request', { checkoutRequestId })
    return NextResponse.json(ACCEPTED)
  }
  const initiatorUserId = stkInit.userId
  const stkMeta = stkInit.meta
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

  // Claimed success: confirm with Safaricom before any money is recorded.
  if (await alreadyCredited(checkoutRequestId)) return NextResponse.json(ACCEPTED)
  let verified = false
  try {
    verified = (await stkQuery(checkoutRequestId)).paid
  } catch (error) {
    console.error('M-Pesa STK Query failed; payment not credited', error)
  }
  if (!verified) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: initiatorUserId,
          action: 'MPESA_STK_UNVERIFIED',
          entity: 'Contribution',
          meta: { checkoutRequestId, claimedResultCode: cb.ResultCode ?? null, rawPayload: body as Prisma.InputJsonValue },
        },
      })
    } catch { /* non-fatal */ }
    return NextResponse.json(ACCEPTED)
  }

  const items = cb.CallbackMetadata?.Item || []
  // The amount is the one this site requested, never the figure inside the callback.
  const amount = Number(stkMeta?.amount || 0)
  const receipt = String(items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || '')
  const phone = String(items.find((i) => i.Name === 'PhoneNumber')?.Value || stkMeta?.phone || '')

  const providerReference = receipt || checkoutRequestId
  if (!providerReference || amount <= 0) return NextResponse.json(ACCEPTED)
  let paymentEvent
  try {
    paymentEvent = await prisma.paymentEvent.create({
      data: { provider: 'MPESA', providerReference, amount, phone, receivedAt: new Date(), rawPayload: body as Prisma.InputJsonValue, sourceAccountId: 'acct-mpesa' },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }
    throw error
  }

  if (targetUserId) {
    try {
      const result = await createLedgerContribution({
        userId: targetUserId, amount, description: `M-Pesa STK ${phone}`,
        categoryId: stkMeta?.categoryId || 'cat-other-income',
        campaignId: stkMeta?.campaignId || null,
        projectId: stkMeta?.projectId || null,
        contributionPeriod: stkMeta?.contributionPeriod || null,
        sourceAccountId: 'acct-mpesa', paymentMethod: 'MPESA', providerReference,
        receivedBy: 'M-Pesa Daraja', actorId: targetUserId, status: 'RECONCILED',
      })
      const period = await getPeriodForDate(new Date())
      await prisma.$transaction([
        prisma.paymentEvent.update({ where: { id: paymentEvent.id }, data: { status: 'MATCHED', matchedUserId: targetUserId, matchedContributionId: result.contribution.id } }),
        prisma.reconciliation.create({ data: { transactionId: result.financial.id, paymentEventId: paymentEvent.id, periodId: period.id, notes: 'Automatically matched from the initiating STK request.', reconciledById: targetUserId } }),
        prisma.financialTransaction.update({ where: { id: result.financial.id }, data: { reconciledAt: new Date() } }),
      ])
    } catch (error) {
      console.error('M-Pesa automatic reconciliation deferred to unmatched queue', error)
    }
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

  } else {
    console.error('M-Pesa callback: paid but no matching STK init audit', {
      checkoutRequestId,
      receipt,
      amount,
    })
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
