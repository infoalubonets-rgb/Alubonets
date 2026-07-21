'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveRole, requireAdmin, requireSessionProfile } from '@/lib/auth/session'
import {
  approveGalleryPhoto,
  createContribution,
  createDocument,
  createEvent,
  createGalleryPhoto,
  createWelfareRequest,
  deleteAnnouncement,
  deleteEvent,
  deleteEvents,
  markAnnouncementsRead,
  sendAnnouncement,
  updateWelfareStatus,
  upsertProject,
} from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'
import { sendContributionReceiptEmail, sendWelfareStatusEmail } from '@/lib/email/resend'
import { writeAudit } from '@/lib/audit'

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

  const created = await prisma.contribution.findUnique({
    where: { id: row.id },
    include: { user: true },
  })
  if (created) await sendContributionReceiptEmail(created)

  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CREATE',
    entity: 'Contribution',
    entityId: row.id,
  })

  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/member')
  revalidatePath('/admin')
}

export async function actionEmailReceipt(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Contribution id required')

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: { user: true },
  })
  if (!contribution) throw new Error('Contribution not found')

  await sendContributionReceiptEmail(contribution)

  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_RECEIPT_EMAIL',
    entity: 'Contribution',
    entityId: id,
  })

  revalidatePath('/dashboard/treasurer/contributions')
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
  await writeAudit({
    userId: actor.id,
    action: 'WELFARE_REVIEW',
    entity: 'WelfareRequest',
    entityId: id,
    meta: { status },
  })
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/member')
  revalidatePath('/admin')
}

export async function actionSendAnnouncement(formData: FormData) {
  const actor = await requireAdmin()
  const title = String(formData.get('title') || '').trim()
  const content = String(formData.get('content') || '').trim()
  const audience = String(formData.get('audience') || 'ALL')
  const memberIds = formData.getAll('memberIds').map(String).filter(Boolean)
  if (!title || !content) throw new Error('Title and content required')
  const broadcast = audience !== 'SELECTED'
  if (!broadcast && memberIds.length === 0) {
    throw new Error('Select at least one member')
  }
  const announcement = await sendAnnouncement({
    authorId: actor.id,
    title,
    content,
    broadcast,
    memberIds,
  })
  await writeAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_SEND',
    entity: 'Announcement',
    entityId: announcement.id,
    meta: { broadcast, recipients: broadcast ? 'all' : memberIds.length },
  })
  revalidatePath('/announcements')
  revalidatePath('/dashboard/member')
}

export async function actionMarkAnnouncementsRead() {
  const profile = await requireSessionProfile()
  await markAnnouncementsRead(profile.id)
}

export async function actionDeleteAnnouncement(id: string) {
  await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE', 'ORGANIZER'])
  await deleteAnnouncement(id)
  revalidatePath('/announcements')
  revalidatePath('/dashboard/member')
}

export async function actionCreateEvent(formData: FormData) {
  const actor = await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  const title = String(formData.get('title') || '')
  const startsAt = String(formData.get('startsAt') || '')
  if (!title || !startsAt) throw new Error('Title and start date required')

  const isPublic = formData.get('isPublic') !== 'off'
  const sendNotif = formData.get('sendNotification') !== 'off'
  const imageUrl = String(formData.get('imageUrl') || '') || undefined
  const location = String(formData.get('location') || '') || undefined
  const description = String(formData.get('description') || '') || undefined

  await createEvent({
    title,
    description,
    location,
    imageUrl,
    startsAt: new Date(startsAt),
    isPublic,
  })

  if (sendNotif) {
    const dateStr = new Date(startsAt).toLocaleString('en-KE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    const lines = [`📅 ${dateStr}`]
    if (location) lines.push(`📍 ${location}`)
    if (description) lines.push(description)
    if (!isPublic) lines.push('(Members only — not listed on the public website)')
    await sendAnnouncement({
      authorId: actor.id,
      title: `New event: ${title}`,
      content: lines.join('\n'),
      broadcast: true,
    })
  }

  revalidatePath('/dashboard/organizer')
  revalidatePath('/dashboard/organizer/events')
  revalidatePath('/dashboard/member')
  revalidatePath('/events')
}

const EVENT_PATHS = [
  '/dashboard/organizer',
  '/dashboard/organizer/events',
  '/dashboard/member',
  '/events',
]

export async function actionDeleteEvent(id: string) {
  await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  await deleteEvent(id)
  EVENT_PATHS.forEach(revalidatePath)
}

export async function actionDeleteEvents(ids: string[]) {
  await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  if (!ids.length) return
  await deleteEvents(ids)
  EVENT_PATHS.forEach(revalidatePath)
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

  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CSV_IMPORT',
    entity: 'Contribution',
    meta: { created },
  })

  revalidatePath('/dashboard/treasurer')
  return { created }
}
