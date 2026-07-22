'use server'

import { revalidateTag } from 'next/cache'
import { requireSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { initiateStkPush, formatPhone } from '@/lib/mpesa'
import { TAGS } from '@/lib/data/queries'

export async function actionInitiateStkPush(data: {
  phone: string
  amount: number
  category: string
  description?: string
}): Promise<{ checkoutRequestId: string; message: string }> {
  const profile = await requireSessionProfile()
  if (profile.status !== 'ACTIVE') throw new Error('Account not active')

  const amount = Math.round(data.amount)
  if (!data.phone) throw new Error('Phone number is required')
  if (!amount || amount < 1) throw new Error('Amount must be at least KES 1')

  const callbackUrl =
    process.env.MPESA_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/mpesa/callback`

  const result = await initiateStkPush({
    phone: data.phone,
    amount,
    accountRef: 'ALUBONETS',
    description: (data.category || 'Contribution').slice(0, 13),
    callbackUrl,
  })

  if (result.ResponseCode !== '0') {
    throw new Error(result.ResponseDescription || 'STK Push was rejected. Try again.')
  }

  // Record a pending contribution — mpesaRef holds CheckoutRequestID until callback confirms
  await prisma.contribution.create({
    data: {
      userId:        profile.id,
      amount,
      category:      data.category,
      description:   data.description || null,
      paymentMethod: 'MPESA',
      mpesaRef:      result.CheckoutRequestID,
      receivedBy:    'M-Pesa STK Push (pending)',
    },
  })

  revalidateTag(TAGS.contributions)

  return {
    checkoutRequestId: result.CheckoutRequestID,
    message: result.CustomerMessage || 'Check your phone and enter your M-Pesa PIN.',
  }
}
