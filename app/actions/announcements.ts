'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { sendBroadcastEmail, sendDirectEmails } from '@/lib/email/resend'
import { createServerClient } from '@/lib/supabase-server'
import {
  validateAnnouncementAttachmentFiles,
} from '@/lib/announcement-attachments'

function validateAnnouncementAttachments(files: File[]) {
  const error = validateAnnouncementAttachmentFiles(files)
  if (error) throw new Error(error)
}

async function uploadAnnouncementAttachments(announcementId: string, files: File[]) {
  if (!files.length) return
  const supabase = createServerClient()
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 80) || 'attachment'
    const path = `announcement-attachments/${announcementId}/${Date.now()}-${safeName}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error } = await supabase.storage.from('documents').upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) throw new Error(`Failed to upload "${file.name}": ${error.message}`)
    await prisma.announcementAttachment.create({
      data: {
        announcementId,
        filename: file.name || safeName,
        storagePath: path,
        mimeType: file.type || null,
        sizeBytes: file.size,
      },
    })
  }
}

async function downloadAnnouncementAttachments(
  attachments: { filename: string; storagePath: string; mimeType: string | null }[],
) {
  if (!attachments.length) return undefined
  const supabase = createServerClient()
  const out: { filename: string; content: Buffer; contentType?: string }[] = []
  for (const a of attachments) {
    const { data, error } = await supabase.storage.from('documents').download(a.storagePath)
    if (error || !data) continue // skip a missing/broken attachment rather than failing the whole send
    out.push({ filename: a.filename, content: Buffer.from(await data.arrayBuffer()), contentType: a.mimeType ?? undefined })
  }
  return out.length ? out : undefined
}

function refreshAnnouncements() {
  revalidatePath('/announcements')
  revalidatePath('/admin/announcements')
  revalidatePath('/dashboard/member')
  revalidateTag(TAGS.announcements)
}

export async function upsertAnnouncementTemplate(formData: FormData) {
  const actor = await requireAdmin()
  const data = z
    .object({
      id: z.string().optional(),
      key: z.string().trim().min(2).max(60),
      name: z.string().trim().min(2),
      subject: z.string().trim().min(2),
      bodyHtml: z.string().trim().min(2),
    })
    .parse({
      id: formData.get('id') || undefined,
      key: formData.get('key'),
      name: formData.get('name'),
      subject: formData.get('subject'),
      bodyHtml: formData.get('bodyHtml'),
    })
  const row = data.id
    ? await prisma.announcementTemplate.update({
        where: { id: data.id },
        data: { key: data.key, name: data.name, subject: data.subject, bodyHtml: data.bodyHtml },
      })
    : await prisma.announcementTemplate.create({ data })
  await writeAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_TEMPLATE_UPSERT',
    entity: 'AnnouncementTemplate',
    entityId: row.id,
    newValue: { key: row.key },
  })
  revalidatePath('/admin/announcements')
}

export async function createTargetedAnnouncement(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE', 'ORGANIZER'])
  const data = z
    .object({
      title: z.string().trim().min(2),
      content: z.string().trim().min(2),
    })
    .parse({
      title: formData.get('title'),
      content: formData.get('content'),
    })

  const audienceCategory = z
    .enum(['', 'ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
    .parse(String(formData.get('audienceCategory') || ''))
  const selectAll = formData.get('selectAll') === 'true'
  const memberIds = formData.getAll('memberIds').map(String).filter(Boolean)
  const externalEmails = [
    ...new Set(
      formData
        .getAll('externalEmails')
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  z.array(z.string().email()).max(20).parse(externalEmails)

  const categoryFilter = audienceCategory ? { role: audienceCategory as Role } : {}
  let recipients: { id: string }[] = []
  if (selectAll) {
    recipients = await prisma.user.findMany({
      where: { status: 'ACTIVE', ...categoryFilter },
      select: { id: true },
    })
  } else if (memberIds.length) {
    recipients = await prisma.user.findMany({
      where: { id: { in: memberIds }, status: 'ACTIVE' },
      select: { id: true },
    })
  }

  if (!recipients.length && !externalEmails.length) {
    throw new Error('Select at least one member or add an external email.')
  }

  const attachmentFiles = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
  validateAnnouncementAttachments(attachmentFiles)

  const willDeliverNow = recipients.length > 0 || externalEmails.length > 0
  const announcement = await prisma.announcement.create({
    data: {
      title: data.title,
      content: data.content,
      authorId: actor.id,
      broadcast: selectAll && !audienceCategory,
      status: willDeliverNow ? 'SENDING' : 'SENT',
      publishedAt: new Date(),
      audienceRoles: audienceCategory ? [audienceCategory as Role] : [],
      receipts: recipients.length
        ? {
            create: recipients.map((r) => ({
              userId: r.id,
              emailStatus: 'PENDING',
            })),
          }
        : undefined,
    },
  })

  await uploadAnnouncementAttachments(announcement.id, attachmentFiles)

  await writeAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_CREATE',
    entity: 'Announcement',
    entityId: announcement.id,
    newValue: { recipients: recipients.length, externalEmails: externalEmails.length },
  })
  refreshAnnouncements()

  if (willDeliverNow) {
    after(async () => {
      if (recipients.length) {
        await deliverAnnouncementEmails(announcement.id, actor.id)
      } else {
        await prisma.announcement.update({ where: { id: announcement.id }, data: { status: 'SENT' } })
      }
      if (externalEmails.length) {
        const stored = await prisma.announcement.findUniqueOrThrow({
          where: { id: announcement.id },
          include: { attachments: true },
        })
        const attachments = await downloadAnnouncementAttachments(stored.attachments)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
        await sendDirectEmails({
          emails: externalEmails,
          subject: stored.title,
          title: stored.title,
          body: `<p>${stored.content}</p>`,
          ctaLabel: 'Open announcements',
          ctaUrl: `${appUrl}/announcements`,
          attachments,
          actorId: actor.id,
          template: 'announcement_external',
        })
      }
      refreshAnnouncements()
    })
  }
}

async function deliverAnnouncementEmails(announcementId: string, actorId?: string) {
  const announcement = await prisma.announcement.findUniqueOrThrow({
    where: { id: announcementId },
    include: {
      receipts: {
        where: { emailStatus: { in: ['PENDING', 'FAILED'] } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      },
      attachments: true,
    },
  })
  const template = announcement.templateKey
    ? await prisma.announcementTemplate.findUnique({ where: { key: announcement.templateKey } })
    : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const eligible = announcement.receipts
  if (!eligible.length) {
    // Nothing left to send — still clear a SENDING/SCHEDULED status so the banner drops it.
    if (announcement.status === 'SENDING' || announcement.status === 'SCHEDULED') {
      await prisma.announcement.update({ where: { id: announcementId }, data: { status: 'SENT' } })
    }
    return { sent: 0, failed: 0 }
  }

  // Mark in progress up front — matters for the scheduled-cron and retry paths, which
  // don't already flip the status to SENDING the way the immediate-send path does.
  if (announcement.status !== 'SENDING') {
    await prisma.announcement.update({ where: { id: announcementId }, data: { status: 'SENDING' } })
  }

  const receiptIdByUserId = new Map(eligible.map((e) => [e.userId, e.id]))
  const applyProgress = async (r: { userId: string; ok: boolean; error?: string }) => {
    const receiptId = receiptIdByUserId.get(r.userId)
    if (!receiptId) return
    await prisma.announcementReceipt.update({
      where: { id: receiptId },
      data: r.ok
        ? { emailStatus: 'SENT', emailSentAt: new Date(), emailError: null }
        : { emailStatus: 'FAILED', emailError: r.error ?? 'Send failed', retryCount: { increment: 1 } },
    })
  }

  const subject = template?.subject?.replaceAll('{{title}}', announcement.title) || announcement.title
  const body =
    template?.bodyHtml
      ?.replaceAll('{{title}}', announcement.title)
      .replaceAll('{{content}}', announcement.content) || `<p>${announcement.content}</p>`

  try {
    const attachments = await downloadAnnouncementAttachments(announcement.attachments)
    const result = await sendBroadcastEmail({
      subject,
      title: announcement.title,
      body,
      ctaLabel: 'Open announcements',
      ctaUrl: `${appUrl}/announcements`,
      imageUrl: announcement.imageUrl || undefined,
      template: announcement.templateKey || 'announcement',
      actorId,
      memberIds: eligible.map((e) => e.userId),
      attachments,
      onProgress: applyProgress,
    })

    if (!result.results) {
      // RESEND_API_KEY not configured — every eligible receipt was skipped alike.
      await prisma.announcementReceipt.updateMany({
        where: { id: { in: eligible.map((e) => e.id) } },
        data: { emailStatus: 'FAILED', emailError: 'Email is not configured.', retryCount: { increment: 1 } },
      })
      await prisma.announcement.update({ where: { id: announcementId }, data: { status: 'SENT' } })
      return { sent: 0, failed: eligible.length }
    }

    await prisma.announcement.update({
      where: { id: announcementId },
      data: result.sent > 0 ? { emailSentAt: new Date(), status: 'SENT' } : { status: 'SENT' },
    })
    return { sent: result.sent, failed: result.failed ?? 0 }
  } catch (e) {
    await prisma.announcementReceipt.updateMany({
      where: { id: { in: eligible.map((e) => e.id) } },
      data: {
        emailStatus: 'FAILED',
        emailError: e instanceof Error ? e.message : 'Send failed',
        retryCount: { increment: 1 },
      },
    })
    await prisma.announcement.update({ where: { id: announcementId }, data: { status: 'SENT' } })
    return { sent: 0, failed: eligible.length }
  }
}

export async function retryFailedAnnouncementEmails(formData: FormData) {
  const actor = await requireAdmin()
  const announcementId = z.string().min(1).parse(formData.get('announcementId'))
  const result = await deliverAnnouncementEmails(announcementId, actor.id)
  await writeAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_EMAIL_RETRY',
    entity: 'Announcement',
    entityId: announcementId,
    newValue: result,
  })
  refreshAnnouncements()
  return result
}

/**
 * Exports of a 'use server' file can be called as server actions, so the cron-only jobs below
 * check for the cron request's Bearer secret themselves.
 */
async function requireCronRequest() {
  const secret = process.env.CRON_SECRET
  const auth = (await headers()).get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) throw new Error('Not allowed.')
}

export async function processScheduledAnnouncements() {
  await requireCronRequest()
  const due = await prisma.announcement.findMany({
    where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
    select: { id: true, authorId: true },
  })
  let processed = 0
  for (const row of due) {
    await prisma.announcement.update({
      where: { id: row.id },
      data: { status: 'SENDING', publishedAt: new Date() },
    })
    await deliverAnnouncementEmails(row.id, row.authorId)
    processed += 1
  }
  return processed
}

export async function processEventReminders() {
  await requireCronRequest()
  const now = new Date()
  const events = await prisma.event.findMany({
    where: {
      startsAt: { gt: now },
      reminderOffsetsHours: { isEmpty: false },
    },
  })
  let sent = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  for (const event of events) {
    const sentMap = (event.remindersSent as Record<string, string> | null) || {}
    for (const hours of event.reminderOffsetsHours) {
      const key = String(hours)
      if (sentMap[key]) continue
      const remindAt = new Date(event.startsAt.getTime() - hours * 60 * 60 * 1000)
      if (remindAt > now) continue
      const invitees = await prisma.eventInvitation.findMany({
        where: { eventId: event.id },
        select: { userId: true },
      })
      const rsvps = await prisma.eventRSVP.findMany({
        where: { eventId: event.id, status: { in: ['GOING', 'MAYBE'] } },
        select: { userId: true },
      })
      const memberIds = [...new Set([...invitees, ...rsvps].map((r) => r.userId))]
      if (memberIds.length) {
        await sendBroadcastEmail({
          subject: `Reminder: ${event.title} in ${hours}h`,
          title: event.title,
          body: `<p>Reminder: <strong>${event.title}</strong> starts ${event.startsAt.toLocaleString()}.</p>`,
          ctaLabel: 'View event',
          ctaUrl: `${appUrl}/events/${event.id}`,
          template: 'event_reminder',
          memberIds,
        })
        sent += memberIds.length
      }
      sentMap[key] = now.toISOString()
    }
    await prisma.event.update({
      where: { id: event.id },
      data: { remindersSent: sentMap },
    })
  }
  return sent
}

export async function retryFailedAnnouncementEmailsBatch() {
  await requireCronRequest()
  const failed = await prisma.announcementReceipt.findMany({
    where: { emailStatus: 'FAILED', retryCount: { lt: 3 } },
    select: { announcementId: true },
    distinct: ['announcementId'],
    take: 20,
  })
  let n = 0
  for (const row of failed) {
    await deliverAnnouncementEmails(row.announcementId)
    n += 1
  }
  return n
}
