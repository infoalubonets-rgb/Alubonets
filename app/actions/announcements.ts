'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { sendBroadcastEmail } from '@/lib/email/resend'

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
      imageUrl: z.string().trim().optional(),
      familyBranch: z.string().trim().optional(),
      scheduledFor: z.coerce.date().optional(),
      sendEmail: z.enum(['on', 'off']).optional(),
      templateKey: z.string().trim().optional(),
    })
    .parse({
      title: formData.get('title'),
      content: formData.get('content'),
      imageUrl: formData.get('imageUrl') || undefined,
      familyBranch: formData.get('familyBranch') || undefined,
      scheduledFor: formData.get('scheduledFor') || undefined,
      sendEmail: formData.has('sendEmail') ? 'on' : 'off',
      templateKey: formData.get('templateKey') || undefined,
    })
  const audienceRoles = formData.getAll('audienceRoles').map(String) as Role[]
  const memberIds = formData.getAll('memberIds').map(String).filter(Boolean)
  const where = {
    status: 'ACTIVE' as const,
    ...(memberIds.length
      ? { id: { in: memberIds } }
      : audienceRoles.length
        ? { role: { in: audienceRoles } }
        : data.familyBranch
          ? { memberProfile: { familyBranch: data.familyBranch } }
          : {}),
  }
  const recipients = await prisma.user.findMany({ where, select: { id: true } })
  if (!recipients.length) throw new Error('No recipients match the selected audience.')

  const scheduled = Boolean(data.scheduledFor && data.scheduledFor > new Date())
  const announcement = await prisma.announcement.create({
    data: {
      title: data.title,
      content: data.content,
      imageUrl: data.imageUrl ?? null,
      authorId: actor.id,
      broadcast: !memberIds.length && !audienceRoles.length && !data.familyBranch,
      status: scheduled ? 'SCHEDULED' : 'SENT',
      scheduledFor: scheduled ? data.scheduledFor : null,
      publishedAt: scheduled ? data.scheduledFor! : new Date(),
      audienceRoles,
      familyBranch: data.familyBranch ?? null,
      templateKey: data.templateKey ?? null,
      receipts: {
        create: recipients.map((r) => ({
          userId: r.id,
          emailStatus: data.sendEmail === 'off' ? 'SKIPPED' : 'PENDING',
        })),
      },
    },
  })

  if (!scheduled && data.sendEmail !== 'off') {
    await deliverAnnouncementEmails(announcement.id, actor.id)
  }

  await writeAudit({
    userId: actor.id,
    action: scheduled ? 'ANNOUNCEMENT_SCHEDULE' : 'ANNOUNCEMENT_CREATE',
    entity: 'Announcement',
    entityId: announcement.id,
    newValue: { recipients: recipients.length, scheduled },
  })
  refreshAnnouncements()
}

export async function deliverAnnouncementEmails(announcementId: string, actorId?: string) {
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
    },
  })
  const template = announcement.templateKey
    ? await prisma.announcementTemplate.findUnique({ where: { key: announcement.templateKey } })
    : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const eligible = announcement.receipts
  if (!eligible.length) return { sent: 0, failed: 0 }

  const subject = template?.subject?.replaceAll('{{title}}', announcement.title) || announcement.title
  const body =
    template?.bodyHtml
      ?.replaceAll('{{title}}', announcement.title)
      .replaceAll('{{content}}', announcement.content) || `<p>${announcement.content}</p>`

  try {
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
    })
    const ok = 'sent' in result ? result.sent > 0 : false
    await prisma.announcementReceipt.updateMany({
      where: { id: { in: eligible.map((e) => e.id) } },
      data: ok
        ? { emailStatus: 'SENT', emailSentAt: new Date(), emailError: null }
        : {
            emailStatus: 'FAILED',
            emailError: 'error' in result ? String(result.error) : 'Send failed',
            retryCount: { increment: 1 },
          },
    })
    if (ok) {
      await prisma.announcement.update({
        where: { id: announcementId },
        data: { emailSentAt: new Date(), status: 'SENT' },
      })
    }
    return { sent: ok ? eligible.length : 0, failed: ok ? 0 : eligible.length }
  } catch (e) {
    await prisma.announcementReceipt.updateMany({
      where: { id: { in: eligible.map((e) => e.id) } },
      data: {
        emailStatus: 'FAILED',
        emailError: e instanceof Error ? e.message : 'Send failed',
        retryCount: { increment: 1 },
      },
    })
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

export async function processScheduledAnnouncements() {
  const due = await prisma.announcement.findMany({
    where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
    select: { id: true, authorId: true },
  })
  let processed = 0
  for (const row of due) {
    await prisma.announcement.update({
      where: { id: row.id },
      data: { status: 'SENT', publishedAt: new Date() },
    })
    await deliverAnnouncementEmails(row.id, row.authorId)
    processed += 1
  }
  return processed
}

export async function processEventReminders() {
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
