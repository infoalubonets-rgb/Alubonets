import { NextRequest, NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { mpesaConfigured, stkPush } from '@/lib/mpesa/daraja'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { resolveStkPurpose } from '@/lib/mpesa/purpose'

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Members do not submit their own payments — the Treasurer records every contribution.
  // Enforced here as well as in the UI, since a server action is a callable HTTP endpoint.
  if (profile.role !== 'TREASURER' && profile.role !== 'ADMIN' && !profile.isSuperAdmin) {
    return NextResponse.json(
      { error: 'Only the Treasurer can record payments. Please hand your payment details to the Treasurer.' },
      { status: 403 },
    )
  }

  if (!mpesaConfigured()) {
    return NextResponse.json(
      {
        error:
          'M-Pesa env vars not configured. Set MPESA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY.',
      },
      { status: 503 }
    )
  }

  const contentType = req.headers.get('content-type') || ''
  let phone = ''
  let amount = 0
  let userId = profile.id
  let rawPurpose: Record<string, string | undefined> = {}
  const pick = (value: unknown) => (value ? String(value) : undefined)

  if (contentType.includes('application/json')) {
    const body = await req.json()
    phone = String(body.phone || '')
    amount = Number(body.amount || 0)
    if (body.userId && (profile.role === 'ADMIN' || profile.role === 'TREASURER')) {
      userId = String(body.userId)
    }
    rawPurpose = {
      categoryId: pick(body.categoryId),
      campaignId: pick(body.campaignId),
      projectId: pick(body.projectId),
      contributionPeriod: pick(body.contributionPeriod),
    }
  } else {
    const form = await req.formData()
    phone = String(form.get('phone') || '')
    amount = Number(form.get('amount') || 0)
    const formUser = String(form.get('userId') || '')
    if (formUser && (profile.role === 'ADMIN' || profile.role === 'TREASURER')) {
      userId = formUser
    }
    rawPurpose = {
      categoryId: pick(form.get('categoryId')),
      campaignId: pick(form.get('campaignId')),
      projectId: pick(form.get('projectId')),
      contributionPeriod: pick(form.get('contributionPeriod')),
    }
  }

  if (!phone || !amount) {
    return NextResponse.json({ error: 'phone and amount required' }, { status: 400 })
  }

  let purpose
  try {
    purpose = await resolveStkPurpose(rawPurpose)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid payment purpose' },
      { status: 400 },
    )
  }

  let result
  try {
    result = await stkPush({
      phone,
      amount,
      accountReference: userId.slice(0, 12),
      description: 'Alubonets',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'STK push failed' },
      { status: 500 },
    )
  }

  await writeAudit({
    userId: profile.id,
    action: 'MPESA_STK_INIT',
    entity: 'Contribution',
    meta: {
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      targetUserId: userId,
      phone,
      amount,
      ...purpose,
    },
  })

  return NextResponse.json({ ok: true, ...result })
}
