'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { getWelfarePolicy } from '@/lib/settings'
import { amountKes } from '@/lib/money-limits'
import { requireWelfareEnabled } from '@/lib/feature-flags'
import { sendWelfareStatusEmail } from '@/lib/email/resend'
import { notifyRoleHolders, notifyUsers } from '@/lib/notifications'

function refreshWelfare() {
  revalidatePath('/dashboard/member/welfare')
  revalidatePath('/dashboard/treasurer/welfare')
  revalidatePath('/dashboard/executive/welfare')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/executive')
  revalidatePath('/admin')
  revalidateTag(TAGS.welfare)
}

export async function actionCreateWelfare(formData: FormData) {
  await requireWelfareEnabled()
  const actor = await requireActiveRole(['MEMBER', 'ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER'])
  const parsed = z.object({
    description: z.string().trim().min(3).max(2000),
    amount: amountKes(),
    beneficiaryName: z.string().trim().max(120).optional().or(z.literal('')),
    supportType: z.string().trim().max(80).optional().or(z.literal('')),
    categoryId: z.string().optional().or(z.literal('')),
    confidentiality: z.enum(['STANDARD', 'CONFIDENTIAL']).default('STANDARD'),
  }).parse({
    description: formData.get('description'),
    amount: formData.get('amount'),
    beneficiaryName: formData.get('beneficiaryName') || '',
    supportType: formData.get('supportType') || '',
    categoryId: formData.get('categoryId') || '',
    confidentiality: formData.get('confidentiality') || 'STANDARD',
  })
  const policy = await getWelfarePolicy()
  if (parsed.amount < policy.minAmountKes || parsed.amount > policy.maxAmountKes) {
    redirect('/dashboard/member/welfare?error=limits')
  }

  const request = await prisma.welfareRequest.create({
    data: {
      userId: actor.id,
      description: parsed.description,
      amount: parsed.amount,
      beneficiaryName: parsed.beneficiaryName || actor.fullName,
      supportType: parsed.supportType || null,
      categoryId: parsed.categoryId || null,
      confidentiality: parsed.confidentiality,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'WELFARE_CREATE',
    entity: 'WelfareRequest',
    entityId: request.id,
    newValue: {
      amount: parsed.amount,
      confidentiality: parsed.confidentiality,
      supportType: parsed.supportType || null,
    },
  })
  await notifyRoleHolders(['TREASURER', 'EXECUTIVE', 'ADMIN'], {
    title: 'New welfare request',
    body: parsed.confidentiality === 'CONFIDENTIAL'
      ? 'A confidential welfare request needs Treasurer and Executive approval.'
      : `${actor.fullName} requested KES ${Math.round(parsed.amount).toLocaleString()}.`,
    href: '/dashboard/treasurer/welfare',
    type: 'welfare',
    entity: 'WelfareRequest',
    entityId: request.id,
  })
  refreshWelfare()
  redirect('/dashboard/member/welfare?submitted=1')
}

export async function actionReviewWelfare(formData: FormData) {
  await requireWelfareEnabled()
  const actor = await requireActiveRole(['TREASURER', 'EXECUTIVE', 'ADMIN'])
  const id = z.string().min(1).parse(formData.get('id'))
  const decision = z.enum(['APPROVED', 'REJECTED']).parse(formData.get('status'))
  const reviewNote = z.string().trim().max(1000).optional().parse(formData.get('reviewNote') || undefined)
  const requestedOffice = z.enum(['TREASURER', 'EXECUTIVE']).optional().parse(
    formData.get('office') ? String(formData.get('office')) : undefined,
  )
  const request = await prisma.welfareRequest.findUniqueOrThrow({ where: { id } })
  if (request.status !== 'PENDING') throw new Error('Only pending requests can be reviewed.')
  if (request.userId === actor.id && !actor.isSuperAdmin) {
    throw new Error('You cannot approve or reject your own welfare request.')
  }

  const isAdminOffice = actor.role === 'ADMIN' || actor.isSuperAdmin
  const isTreasurerOffice = actor.role === 'TREASURER'
  const isExecutiveOffice = actor.role === 'EXECUTIVE'
  if (!isTreasurerOffice && !isExecutiveOffice && !isAdminOffice) {
    throw new Error('Not authorized to review this request.')
  }

  if (decision === 'REJECTED') {
    const updated = await prisma.welfareRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewNote: reviewNote || null },
      include: { user: true },
    })
    await prisma.welfareDecision.create({
      data: { requestId: id, actorId: actor.id, role: actor.role, decision: 'REJECTED', note: reviewNote || null },
    })
    await writeAudit({
      userId: actor.id,
      action: 'WELFARE_REVIEW',
      entity: 'WelfareRequest',
      entityId: id,
      oldValue: { status: request.status },
      newValue: { status: 'REJECTED' },
      reason: reviewNote,
    })
    await sendWelfareStatusEmail(updated.user, 'REJECTED', reviewNote)
    await notifyUsers({
      userIds: [updated.userId],
      title: 'Welfare request rejected',
      body: reviewNote || 'Your welfare request was not approved.',
      href: '/dashboard/member/welfare',
      type: 'welfare',
      entity: 'WelfareRequest',
      entityId: id,
    })
    refreshWelfare()
    return
  }

  let stamp: 'TREASURER' | 'EXECUTIVE'
  if (isTreasurerOffice) stamp = 'TREASURER'
  else if (isExecutiveOffice) stamp = 'EXECUTIVE'
  else {
    stamp = requestedOffice
      || (!request.treasurerApprovedAt ? 'TREASURER' : 'EXECUTIVE')
  }

  const now = new Date()
  const data: {
    treasurerApprovedAt?: Date
    treasurerApprovedById?: string
    executiveApprovedAt?: Date
    executiveApprovedById?: string
    reviewNote?: string | null
    status?: 'APPROVED'
  } = { reviewNote: reviewNote || request.reviewNote }

  if (stamp === 'TREASURER') {
    if (request.treasurerApprovedAt) {
      throw new Error('Treasurer has already approved this request. Waiting for Executive.')
    }
    data.treasurerApprovedAt = now
    data.treasurerApprovedById = actor.id
  } else {
    if (request.executiveApprovedAt) {
      throw new Error('Executive has already approved this request. Waiting for Treasurer.')
    }
    data.executiveApprovedAt = now
    data.executiveApprovedById = actor.id
  }

  const treasurerDone = Boolean(data.treasurerApprovedAt || request.treasurerApprovedAt)
  const executiveDone = Boolean(data.executiveApprovedAt || request.executiveApprovedAt)
  if (treasurerDone && executiveDone) data.status = 'APPROVED'

  const updated = await prisma.welfareRequest.update({
    where: { id },
    data,
    include: { user: true },
  })
  await prisma.welfareDecision.create({
    data: {
      requestId: id,
      actorId: actor.id,
      role: actor.role,
      decision: data.status === 'APPROVED' ? 'APPROVED' : 'STEP_APPROVED',
      note: reviewNote || null,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: data.status === 'APPROVED' ? 'WELFARE_REVIEW' : 'WELFARE_STEP_APPROVE',
    entity: 'WelfareRequest',
    entityId: id,
    oldValue: { status: request.status },
    newValue: {
      status: updated.status,
      treasurerApproved: Boolean(updated.treasurerApprovedAt),
      executiveApproved: Boolean(updated.executiveApprovedAt),
    },
    reason: reviewNote,
  })

  if (data.status === 'APPROVED') {
    await sendWelfareStatusEmail(updated.user, 'APPROVED', reviewNote)
    await notifyUsers({
      userIds: [updated.userId],
      title: 'Welfare request approved',
      body: 'Treasurer and Executive have both approved your request.',
      href: '/dashboard/member/welfare',
      type: 'welfare',
      entity: 'WelfareRequest',
      entityId: id,
    })
  } else {
    await notifyRoleHolders(
      updated.treasurerApprovedAt ? ['EXECUTIVE', 'ADMIN'] : ['TREASURER', 'ADMIN'],
      {
        title: 'Welfare request awaiting second approval',
        body: `${actor.fullName} recorded a ${stamp.toLowerCase()} approval.`,
        href: updated.treasurerApprovedAt ? '/dashboard/executive/welfare' : '/dashboard/treasurer/welfare',
        type: 'welfare',
        entity: 'WelfareRequest',
        entityId: id,
      },
    )
  }
  refreshWelfare()
}
