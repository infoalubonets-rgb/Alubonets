'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { requireActiveRole, requireAdmin, requireSessionProfile } from '@/lib/auth/session'
import {
  TAGS,
  approveGalleryPhoto,
  createContribution,
  createDocument,
  createEvent,
  createGalleryPhoto,
  createWelfareRequest,
  deleteAnnouncement,
  deleteEvent,
  deleteEvents,
  deleteGalleryPhoto,
  deleteGalleryPhotos,
  deleteProject,
  markAnnouncementsRead,
  sendAnnouncement,
  updateEvent,
  updateGalleryPhoto,
  updateWelfareStatus,
  upsertProject,
} from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'
import { sendBroadcastEmail, sendContributionReceiptEmail, sendWelfareStatusEmail } from '@/lib/email/resend'
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
  revalidateTag(TAGS.contributions)
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
  revalidateTag(TAGS.welfare)
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
  revalidateTag(TAGS.welfare)
}

export async function actionSendAnnouncement(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'ORGANIZER', 'SECRETARY', 'EXECUTIVE'])
  const title = String(formData.get('title') || '').trim()
  const content = String(formData.get('content') || '').trim()
  const audience = String(formData.get('audience') || 'ALL')
  const memberIds = formData.getAll('memberIds').map(String).filter(Boolean)
  const sendEmail = formData.get('sendEmail') !== 'off'
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
  // Send email to all members in the background (doesn't block response)
  if (broadcast && sendEmail) {
    const actorId = actor.id
    const announcementId = announcement.id
    const paragraphs = content.split('\n').filter(Boolean)
      .map((p) => `<p style="margin:0 0 8px;">${p}</p>`).join('')
    after(async () => {
      try {
        const result = await sendBroadcastEmail({
          subject: title,
          title,
          body: paragraphs,
          ctaLabel: 'View Announcements',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/announcements`,
          template: 'announcement_broadcast',
          actorId,
        })
        if ('sent' in result && result.sent > 0) {
          await prisma.announcement.update({
            where: { id: announcementId },
            data: { emailSentAt: new Date() },
          })
          revalidateTag(TAGS.announcements)
        }
      } catch (e) {
        console.error(e)
      }
    })
  }
  revalidatePath('/announcements')
  revalidatePath('/dashboard/member')
  revalidateTag(TAGS.announcements)
}

export async function actionMarkAnnouncementsRead() {
  const profile = await requireSessionProfile()
  await markAnnouncementsRead(profile.id)
}

export async function actionDeleteAnnouncement(id: string) {
  await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE', 'ORGANIZER'])
  await deleteAnnouncement(id)
  // Revalidate every path that shows announcements so it disappears for all users
  revalidatePath('/announcements')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/organizer')
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/secretary')
  revalidateTag(TAGS.announcements)
}

export async function actionCreateEvent(formData: FormData) {
  const actor = await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  const title = String(formData.get('title') || '')
  const startsAt = String(formData.get('startsAt') || '')
  if (!title || !startsAt) throw new Error('Title and start date required')

  const isPublic = formData.get('isPublic') !== 'off'
  const sendEmail = formData.get('sendEmail') !== 'off'
  const emailAudience = String(formData.get('emailAudience') || 'ALL')
  const emailMemberIds = formData.getAll('emailMemberId').map(String).filter(Boolean)
  const imageUrl = String(formData.get('imageUrl') || '') || undefined
  const location = String(formData.get('location') || '') || undefined
  const description = String(formData.get('description') || '') || undefined

  const event = await createEvent({
    title,
    description,
    location,
    imageUrl,
    startsAt: new Date(startsAt),
    isPublic,
  })

  const actorId = actor.id
  const dateStr = new Date(startsAt).toLocaleString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const lines = [`📅 ${dateStr}`]
  if (location) lines.push(`📍 ${location}`)
  if (description) lines.push(description)
  if (!isPublic) lines.push('(Members only — not listed on the public website)')

  after(() => sendAnnouncement({
    authorId: actorId,
    title: `New event: ${title}`,
    content: lines.join('\n'),
    broadcast: true,
    includeSelf: true,
  }).catch(console.error))

  if (sendEmail) {
    const memberIds = emailAudience === 'SELECTED' && emailMemberIds.length ? emailMemberIds : undefined
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const paragraphs = lines.map((l) => `<p style="margin:0 0 6px;">${l}</p>`).join('')
    after(async () => {
      try {
        const result = await sendBroadcastEmail({
          subject: `New event: ${title}`,
          title: `Upcoming event — ${title}`,
          body: paragraphs,
          imageUrl: imageUrl || undefined,
          ctaLabel: 'View Event',
          ctaUrl: `${appBaseUrl}/events/${event.id}`,
          template: 'event_notification',
          actorId,
          memberIds,
        })
        if ('sent' in result && result.sent > 0) {
          await sendAnnouncement({
            authorId: actorId,
            title: `Email sent: ${title}`,
            content: `Your email notification for "${title}" was successfully sent to ${result.sent} member${result.sent !== 1 ? 's' : ''}.`,
            broadcast: false,
            memberIds: [actorId],
          })
          revalidateTag(TAGS.announcements)
        }
      } catch (e) {
        console.error(e)
      }
    })
  }

  revalidatePath('/dashboard/organizer')
  revalidatePath('/dashboard/organizer/events')
  revalidatePath('/dashboard/member')
  revalidatePath('/events')
  revalidateTag(TAGS.events)
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
  EVENT_PATHS.forEach((p) => revalidatePath(p))
  revalidateTag(TAGS.events)
}

export async function actionDeleteEvents(ids: string[]) {
  await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  if (!ids.length) return
  await deleteEvents(ids)
  EVENT_PATHS.forEach((p) => revalidatePath(p))
  revalidateTag(TAGS.events)
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
  revalidateTag(TAGS.documents)
}

export async function actionCreateGallery(formData: FormData) {
  const actor = await requireActiveRole(['ORGANIZER', 'ADMIN', 'MEMBER'])
  const url = String(formData.get('url') || '')
  if (!url) throw new Error('Image URL required')
  const caption = String(formData.get('caption') || '') || undefined
  const category = String(formData.get('category') || '') || undefined
  await createGalleryPhoto({
    url,
    caption,
    category,
    uploadedBy: actor.id,
    isPublic: true,
  })
  // In-app announcement for all members (visible in notification toasts)
  const authorId = actor.id
  const lines = ['A new photo has been added to the gallery.']
  if (caption) lines.push(`"${caption}"`)
  if (category) lines.push(`Category: ${category}`)
  after(() => sendAnnouncement({
    authorId,
    title: 'New photo added to gallery',
    content: lines.join('\n'),
    broadcast: true,
    includeSelf: true,
  }).catch(console.error))
  revalidatePath('/dashboard/organizer')
  revalidatePath('/dashboard/organizer/gallery')
  revalidatePath('/admin')
  revalidatePath('/gallery')
  revalidateTag(TAGS.gallery)
}

export async function actionDeleteGalleryPhoto(id: string) {
  await requireActiveRole(['ORGANIZER', 'ADMIN'])
  await deleteGalleryPhoto(id)
  revalidatePath('/dashboard/organizer/gallery')
  revalidatePath('/gallery')
  revalidatePath('/admin')
  revalidateTag(TAGS.gallery)
}

export async function actionDeleteGalleryPhotos(ids: string[]) {
  await requireActiveRole(['ORGANIZER', 'ADMIN'])
  if (!ids.length) return
  await deleteGalleryPhotos(ids)
  revalidatePath('/dashboard/organizer/gallery')
  revalidatePath('/gallery')
  revalidatePath('/admin')
  revalidateTag(TAGS.gallery)
}

export async function actionApproveGallery(formData: FormData) {
  await requireActiveRole(['ADMIN', 'ORGANIZER'])
  const id = String(formData.get('id') || '')
  const approve = formData.get('approve') === 'true'
  await approveGalleryPhoto(id, approve)
  revalidatePath('/admin')
  revalidatePath('/dashboard/organizer')
  revalidatePath('/gallery')
  revalidateTag(TAGS.gallery)
}

export async function actionUpsertProject(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'ORGANIZER'])
  const title = String(formData.get('title') || '')
  const description = String(formData.get('description') || '')
  const status = String(formData.get('status') || 'UPCOMING') as
    | 'UPCOMING'
    | 'ONGOING'
    | 'COMPLETED'
  if (!title || !description) throw new Error('Title and description required')
  const existingId = String(formData.get('id') || '') || undefined
  const rawProgress = Number(formData.get('progress') ?? 0)
  const progress = Math.min(100, Math.max(0, isNaN(rawProgress) ? 0 : rawProgress))
  const project = await upsertProject({
    id: existingId,
    title,
    description,
    status,
    imageUrl: String(formData.get('imageUrl') || '') || undefined,
    progress,
  })

  // Only notify on creation (not updates)
  if (!existingId) {
    const actorId = actor.id
    const sendEmail = formData.get('sendEmail') !== 'off'
    const emailAudience = String(formData.get('emailAudience') || 'ALL')
    const emailMemberIds = formData.getAll('emailMemberId').map(String).filter(Boolean)
    const memberIds = emailAudience === 'SELECTED' && emailMemberIds.length ? emailMemberIds : undefined
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const projectImageUrl = String(formData.get('imageUrl') || '') || undefined
    const projectId = project.id

    // Single after() — create announcement, then optionally send email and mark emailSentAt
    after(async () => {
      try {
        const ann = await sendAnnouncement({
          authorId: actorId,
          title: `New project: ${title}`,
          content: description,
          broadcast: true,
          includeSelf: true,
        })

        if (sendEmail) {
          const result = await sendBroadcastEmail({
            subject: `New project: ${title}`,
            title: `New project — ${title}`,
            body: `<p style="margin:0 0 8px;">${description}</p>`,
            imageUrl: projectImageUrl,
            ctaLabel: 'View Projects',
            ctaUrl: `${appBaseUrl}/projects/${projectId}`,
            template: 'project_notification',
            actorId,
            memberIds,
          })
          if ('sent' in result && result.sent > 0) {
            await prisma.announcement.update({
              where: { id: ann.id },
              data: { emailSentAt: new Date() },
            })
          }
        }

        revalidatePath('/announcements')
        revalidateTag(TAGS.announcements)
      } catch (e) { console.error(e) }
    })
  }

  revalidatePath('/dashboard/executive')
  revalidatePath('/dashboard/organizer')
  revalidatePath('/projects')
  revalidateTag(TAGS.projects)
}

export async function actionUpdateEvent(id: string, formData: FormData) {
  await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  const title = String(formData.get('title') || '')
  const startsAt = String(formData.get('startsAt') || '')
  if (!title || !startsAt) throw new Error('Title and start date required')
  const isPublic = formData.get('isPublic') !== 'off'
  const imageUrl = String(formData.get('imageUrl') || '') || null
  const location = String(formData.get('location') || '') || null
  const description = String(formData.get('description') || '') || null
  await updateEvent(id, {
    title, description, location,
    imageUrl: imageUrl ?? undefined,
    startsAt: new Date(startsAt),
    isPublic,
  })
  EVENT_PATHS.forEach((p) => revalidatePath(p))
  revalidateTag(TAGS.events)
}

export async function actionUpdateGalleryPhoto(formData: FormData) {
  await requireActiveRole(['ORGANIZER', 'ADMIN'])
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Photo ID required')
  const caption = String(formData.get('caption') || '') || null
  const category = String(formData.get('category') || '') || null
  await updateGalleryPhoto(id, { caption, category })
  revalidatePath('/dashboard/organizer/gallery')
  revalidatePath('/gallery')
  revalidatePath('/admin')
  revalidateTag(TAGS.gallery)
}

export async function actionDeleteProject(id: string) {
  await requireActiveRole(['ADMIN', 'EXECUTIVE', 'ORGANIZER'])
  await deleteProject(id)
  revalidatePath('/dashboard/executive')
  revalidatePath('/dashboard/executive/projects')
  revalidatePath('/dashboard/organizer')
  revalidatePath('/dashboard/organizer/projects')
  revalidatePath('/projects')
  revalidateTag(TAGS.projects)
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
  revalidateTag(TAGS.contributions)
  return { created }
}
