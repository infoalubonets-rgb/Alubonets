'use server'

import { revalidateTag } from 'next/cache'
import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { initiateStkPush } from '@/lib/mpesa'
import { TAGS } from '@/lib/data/queries'

export async function actionInitiateStkPush(data: {
  phone: string
  amount: number
  category: string
  description?: string
  userId?: string
  categoryId?: string
  campaignId?: string
  projectId?: string
  contributionPeriod?: string
}): Promise<{ checkoutRequestId: string; message: string }> {
  // Same rule as /api/mpesa/stk: the Treasurer records payments until member-facing STK is switched on.
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  const { mpesaCallbackUrl, mpesaConfigured } = await import('@/lib/mpesa/daraja')
  const { resolveStkPurpose } = await import('@/lib/mpesa/purpose')
  if (!mpesaConfigured()) throw new Error('M-Pesa is not configured yet.')

  const amount = Math.round(data.amount)
  if (!data.phone) throw new Error('Phone number is required')
  if (!amount || amount < 1) throw new Error('Amount must be at least KES 1')
  const purpose = await resolveStkPurpose({
    categoryId: data.categoryId || undefined,
    campaignId: data.campaignId || undefined,
    projectId: data.projectId || undefined,
    contributionPeriod: data.contributionPeriod || undefined,
  })
  const targetUserId = data.userId || profile.id

  const result = await initiateStkPush({
    phone: data.phone,
    amount,
    accountRef: 'ALUBONETS',
    description: (data.category || 'Contribution').slice(0, 13),
    callbackUrl: mpesaCallbackUrl(),
  })

  if (result.ResponseCode !== '0') {
    throw new Error(result.ResponseDescription || 'STK Push was rejected. Try again.')
  }

  await prisma.auditLog.create({
    data: {
      userId: profile.id,
      action: 'MPESA_STK_INIT',
      entity: 'PaymentEvent',
      meta: {
        checkoutRequestId: result.CheckoutRequestID,
        targetUserId,
        amount,
        phone: data.phone,
        category: data.category,
        description: data.description || null,
        ...purpose,
      },
    },
  })

  revalidateTag(TAGS.contributions)

  return {
    checkoutRequestId: result.CheckoutRequestID,
    message: result.CustomerMessage || 'Check your phone and enter your M-Pesa PIN.',
  }
}
