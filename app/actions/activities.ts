'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { appTodayInputValue, todayRange } from '@/lib/dates'
import { notifyUsers } from '@/lib/notifications'
import { sendBroadcastEmail } from '@/lib/email/resend'
import { createSignedUpload } from '@/lib/upload-signed'
import { createServerClient } from '@/lib/supabase-server'

const ACTIVITY_CREATORS = ['ADMIN', 'SECRETARY', 'ORGANIZER', 'EXECUTIVE'] as const
const IMAGE_BUCKET = 'gallery'
const IMAGE_FOLDER = 'activity-images'

const activitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  title: z.string().trim().min(3, 'Add a heading.').max(200),
  subtitle: z.string().trim().max(240).optional(),
  body: z.string().trim().max(4000).optional(),
  imageUrl: z
    .string()
    .url()
    .refine((url) => url.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/${IMAGE_FOLDER}/`), 'Invalid image.')
    .optional(),
  sendEmail: z.boolean(),
})

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

type Viewer = { id: string; role: string; isSuperAdmin?: boolean }

/** Admins may delete any activity; other creators only their own. */
function canDeleteActivity(viewer: Viewer, createdById: string) {
  if (viewer.role === 'ADMIN' || viewer.isSuperAdmin) return true
  return (ACTIVITY_CREATORS as readonly string[]).includes(viewer.role) && viewer.id === createdById
}

function toActivityView(
  row: Prisma.DailyActivityGetPayload<{ include: { createdBy: { select: { fullName: true } } } }>,
  viewer: Viewer,
) {
  return {
    canDelete: canDeleteActivity(viewer, row.createdById),
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    imageUrl: row.imageUrl,
    activityType: row.activityType,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() || null,
    venue: row.venue,
    emailed: Boolean(row.emailSentAt),
    createdByName: row.createdBy.fullName,
  }
}

/** Activities the viewer may see, from the start of today onward. */
async function listActivities(windowFilter: (start: Date, end: Date) => Prisma.DailyActivityWhereInput, take: number) {
  // Identity comes from the session — a caller must not be able to claim a role or branch.
  const viewer = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  const { start, end } = todayRange()
  const branchRoot = viewer.isPrincipal ? viewer.id : viewer.principalMemberId

  // Audience is filtered in the query, before `take`, so a member never loses visible
  // activities to rows they were not entitled to see. Unlisted audience types match nothing.
  const audienceFilter: Prisma.DailyActivityWhereInput = {
    OR: [
      { audienceType: 'ALL_MEMBERS' },
      { audienceType: 'SELECTED_ROLES', audienceRoles: { has: viewer.role } },
      ...(branchRoot
        ? [{ audienceType: 'BRANCH_MEMBERS' as const, audiencePrincipalId: branchRoot }]
        : []),
    ],
  }

  const rows = await prisma.dailyActivity.findMany({
    where: { published: true, AND: [audienceFilter, windowFilter(start, end)] },
    orderBy: { startsAt: 'asc' },
    take,
    include: { createdBy: { select: { fullName: true } } },
  })
  return rows.map((row) => toActivityView(row, viewer))
}

export async function listTodayActivities() {
  // An open-ended activity counts as today's only if it starts today; one with an end date
  // stays listed until that end passes.
  return listActivities(
    (start, end) => ({
      OR: [
        { endsAt: null, startsAt: { gte: start, lte: end } },
        { endsAt: { gte: start }, startsAt: { lte: end } },
      ],
    }),
    40,
  )
}

/** Today's activities plus everything scheduled after today. */
export async function listUpcomingActivities() {
  return listActivities(
    (start) => ({
      OR: [{ startsAt: { gte: start } }, { endsAt: { gte: start } }],
    }),
    100,
  )
}

/** Deletes an activity, the notifications it sent, and its image. Emails already sent stay sent. */
export async function deleteDailyActivity(formData: FormData) {
  const actor = await requireActiveRole([...ACTIVITY_CREATORS])
  const id = z.string().min(1).parse(formData.get('id'))
  const activity = await prisma.dailyActivity.findUnique({ where: { id } })
  if (!activity) throw new Error('Activity not found.')
  if (!canDeleteActivity(actor, activity.createdById)) throw new Error('You can only delete activities you posted.')

  const [, notifications] = await prisma.$transaction([
    prisma.dailyActivity.delete({ where: { id } }),
    prisma.userNotification.deleteMany({ where: { entity: 'DailyActivity', entityId: id } }),
  ])

  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
  if (activity.imageUrl?.includes(marker)) {
    const path = activity.imageUrl.split(marker)[1]
    // Best effort: a leftover file must not block deleting the activity.
    await createServerClient().storage.from(IMAGE_BUCKET).remove([path]).catch(() => {})
  }

  await writeAudit({
    userId: actor.id,
    action: 'DAILY_ACTIVITY_DELETE',
    entity: 'DailyActivity',
    entityId: id,
    oldValue: { title: activity.title, startsAt: activity.startsAt.toISOString() },
    newValue: { notificationsRemoved: notifications.count },
  })

  revalidatePath('/today')
  revalidatePath('/dashboard/member')
  revalidatePath('/notifications')
}

/** Signed upload slot for an activity's optional image. */
export async function prepareActivityImageUpload() {
  await requireActiveRole([...ACTIVITY_CREATORS])
  const path = `${IMAGE_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  return createSignedUpload(IMAGE_BUCKET, path)
}

export async function createDailyActivity(formData: FormData) {
  const actor = await requireActiveRole([...ACTIVITY_CREATORS])
  const parsed = activitySchema.parse({
    date: formData.get('date'),
    title: formData.get('title'),
    subtitle: formData.get('subtitle') || undefined,
    body: formData.get('body') || undefined,
    imageUrl: formData.get('imageUrl') || undefined,
    sendEmail: formData.get('sendEmail') === 'on',
  })
  // Guard the server too: an activity can be for today or later, never a past day.
  if (parsed.date < appTodayInputValue()) throw new Error('The activity date cannot be in the past.')

  // The whole chosen day, in the group's timezone (noon UTC is always the same Nairobi date).
  const day = todayRange(new Date(`${parsed.date}T12:00:00Z`))

  const activity = await prisma.dailyActivity.create({
    data: {
      title: parsed.title,
      subtitle: parsed.subtitle,
      body: parsed.body,
      imageUrl: parsed.imageUrl,
      startsAt: day.start,
      endsAt: day.end,
      audienceType: 'ALL_MEMBERS',
      createdById: actor.id,
      published: true,
    },
  })

  const members = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
  const dateLabel = new Date(`${parsed.date}T12:00:00Z`).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  await notifyUsers({
    userIds: members.map((member) => member.id),
    title: `New activity: ${parsed.title}`,
    body: parsed.subtitle ? `${dateLabel} · ${parsed.subtitle}` : dateLabel,
    href: '/today',
    type: 'ACTIVITY',
    entity: 'DailyActivity',
    entityId: activity.id,
  })

  let emailResult: { sent: number; failed?: number } | null = null
  if (parsed.sendEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const html = [
      `<p style="margin:0 0 4px;font-weight:600;">${escapeHtml(dateLabel)}</p>`,
      parsed.subtitle ? `<p style="margin:0 0 12px;color:#6b7280;">${escapeHtml(parsed.subtitle)}</p>` : '',
      parsed.body ? `<p style="white-space:pre-line;">${escapeHtml(parsed.body)}</p>` : '',
    ].join('')
    emailResult = await sendBroadcastEmail({
      subject: `Activity: ${parsed.title}`,
      title: escapeHtml(parsed.title),
      body: html,
      ctaLabel: 'View activities',
      ctaUrl: `${appUrl}/today`,
      imageUrl: parsed.imageUrl,
      template: 'activity',
      actorId: actor.id,
    })
    if (emailResult.sent > 0) {
      await prisma.dailyActivity.update({ where: { id: activity.id }, data: { emailSentAt: new Date() } })
    }
  }

  await writeAudit({
    userId: actor.id,
    action: 'DAILY_ACTIVITY_CREATE',
    entity: 'DailyActivity',
    entityId: activity.id,
    newValue: { title: activity.title, date: parsed.date, emailed: parsed.sendEmail, emailResult },
  })

  revalidatePath('/today')
  revalidatePath('/dashboard/member')
  revalidatePath('/notifications')
  return { id: activity.id, notified: members.length, emailed: emailResult?.sent ?? 0, emailRequested: parsed.sendEmail }
}
