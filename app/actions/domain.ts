'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveRole } from '@/lib/auth/session'
import {
  approveGalleryPhoto,
  createAnnouncement,
  createContribution,
  createDocument,
  createEvent,
  createGalleryPhoto,
  createMeeting,
  createWelfareRequest,
  updateWelfareStatus,
  upsertProject,
} from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'
import { sendContributionReceiptEmail, sendWelfareStatusEmail } from '@/lib/email/resend'

export async function actionCreateContribution(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const schema = z.object({
    userId: z.string().min(1),
    amount: z.coerce.number().positive(),
    description: z.string().optional(),
    category: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'MPESA', 'BANK', 'OTHER']).default('CASH'),
    mpesaRef: z.string().optional(),
  })
  const parsed = schema.parse({
    userId: formData.get('userId'),
    amount: formData.get('amount'),
    description: formData.get('description') || undefined,
    category: formData.get('category') || undefined,
    paymentMethod: formData.get('paymentMethod') || 'CASH',
    mpesaRef: formData.get('mpesaRef') || undefined,
  })

  const row = await createContribution({
    ...parsed,
    receivedBy: actor.fullName,
  })

  const member = await prisma.user.findUnique({ where: { id: parsed.userId } })
  if (member) await sendContributionReceiptEmail(member, parsed.amount, parsed.mpesaRef)

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'CONTRIBUTION_CREATE',
      entity: 'Contribution',
      entityId: row.id,
    },
  })

  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/member')
  revalidatePath('/admin')
}

export async function actionCreateWelfare(formData: FormData) {
  const actor = await requireActiveRole(['MEMBER', 'ADMIN'])
  const description = String(formData.get('description') || '')
  const amountRaw = formData.get('amount')
  if (!description) throw new Error('Description required')
  const amount = amountRaw ? Number(amountRaw) : undefined
  await createWelfareRequest(actor.id, description, amount)
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/admin')
}

export async function actionReviewWelfare(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '') as 'APPROVED' | 'REJECTED' | 'PAID'
  const reviewNote = String(formData.get('reviewNote') || '') || undefined
  if (!id || !['APPROVED', 'REJECTED', 'PAID'].includes(status)) {
    throw new Error('Invalid welfare review')
  }
  const updated = await updateWelfareStatus(id, status, reviewNote)
  await sendWelfareStatusEmail(updated.user, status, reviewNote)
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'WELFARE_REVIEW',
      entity: 'WelfareRequest',
      entityId: id,
      meta: { status },
    },
  })
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/member')
  revalidatePath('/admin')
}

export async function actionCreateAnnouncement(formData: FormData) {
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN', 'EXECUTIVE'])
  const title = String(formData.get('title') || '')
  const content = String(formData.get('content') || '')
  if (!title || !content) throw new Error('Title and content required')
  await createAnnouncement(actor.id, title, content)
  revalidatePath('/dashboard/secretary')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/executive')
}

export async function actionCreateEvent(formData: FormData) {
  await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  const title = String(formData.get('title') || '')
  const startsAt = String(formData.get('startsAt') || '')
  if (!title || !startsAt) throw new Error('Title and start date required')
  await createEvent({
    title,
    description: String(formData.get('description') || '') || undefined,
    location: String(formData.get('location') || '') || undefined,
    startsAt: new Date(startsAt),
  })
  revalidatePath('/dashboard/organizer')
  revalidatePath('/dashboard/member')
}

export async function actionCreateMeeting(formData: FormData) {
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const title = String(formData.get('title') || '')
  const heldAt = String(formData.get('heldAt') || '')
  if (!title || !heldAt) throw new Error('Title and date required')
  await createMeeting({
    title,
    agenda: String(formData.get('agenda') || '') || undefined,
    minutes: String(formData.get('minutes') || '') || undefined,
    heldAt: new Date(heldAt),
    attendance: Number(formData.get('attendance') || 0),
    recordedBy: actor.id,
  })
  revalidatePath('/dashboard/secretary')
}

export async function actionCreateDocument(formData: FormData) {
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const title = String(formData.get('title') || '')
  const fileUrl = String(formData.get('fileUrl') || '')
  if (!title || !fileUrl) throw new Error('Title and file URL required')
  await createDocument({
    title,
    fileUrl,
    category: String(formData.get('category') || '') || undefined,
    uploadedBy: actor.id,
  })
  revalidatePath('/dashboard/secretary')
  revalidatePath('/dashboard/member')
}

export async function actionCreateGallery(formData: FormData) {
  const actor = await requireActiveRole(['ORGANIZER', 'ADMIN', 'MEMBER'])
  const url = String(formData.get('url') || '')
  if (!url) throw new Error('Image URL required')
  const autoPublic = actor.role === 'ADMIN' || actor.role === 'ORGANIZER'
  await createGalleryPhoto({
    url,
    caption: String(formData.get('caption') || '') || undefined,
    category: String(formData.get('category') || '') || undefined,
    uploadedBy: actor.id,
    isPublic: autoPublic && formData.get('publish') === 'on',
  })
  revalidatePath('/dashboard/organizer')
  revalidatePath('/admin')
  revalidatePath('/gallery')
}

export async function actionApproveGallery(formData: FormData) {
  await requireActiveRole(['ADMIN', 'ORGANIZER'])
  const id = String(formData.get('id') || '')
  const approve = formData.get('approve') === 'true'
  await approveGalleryPhoto(id, approve)
  revalidatePath('/admin')
  revalidatePath('/dashboard/organizer')
  revalidatePath('/gallery')
}

export async function actionUpsertProject(formData: FormData) {
  await requireActiveRole(['ADMIN', 'EXECUTIVE', 'ORGANIZER'])
  const title = String(formData.get('title') || '')
  const description = String(formData.get('description') || '')
  const status = String(formData.get('status') || 'UPCOMING') as
    | 'UPCOMING'
    | 'ONGOING'
    | 'COMPLETED'
  if (!title || !description) throw new Error('Title and description required')
  await upsertProject({
    id: String(formData.get('id') || '') || undefined,
    title,
    description,
    status,
    imageUrl: String(formData.get('imageUrl') || '') || undefined,
  })
  revalidatePath('/dashboard/executive')
  revalidatePath('/dashboard/organizer')
  revalidatePath('/projects')
}

export async function actionImportContributionsCsv(csvText: string) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const Papa = (await import('papaparse')).default
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || 'CSV parse error')
  }

  let created = 0
  for (const row of parsed.data) {
    const email = (row.email || row.Email || '').trim().toLowerCase()
    const amount = Number(row.amount || row.Amount || 0)
    if (!email || !amount) continue
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) continue
    await createContribution({
      userId: user.id,
      amount,
      description: row.description || row.Description || 'CSV import',
      category: row.category || row.Category || 'Import',
      paymentMethod: (row.paymentMethod as 'CASH' | 'MPESA' | 'BANK' | 'OTHER') || 'CASH',
      mpesaRef: row.mpesaRef || row.MpesaRef || undefined,
      receivedBy: actor.fullName,
    })
    created += 1
  }

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'CONTRIBUTION_CSV_IMPORT',
      entity: 'Contribution',
      meta: { created },
    },
  })

  revalidatePath('/dashboard/treasurer')
  return { created }
}
