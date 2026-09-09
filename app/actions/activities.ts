'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { todayRange } from '@/lib/dates'

const activitySchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().max(4000).optional(),
  activityType: z.string().trim().min(2).max(40).default('GENERAL'),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  audienceType: z.enum(['ALL_MEMBERS', 'SELECTED_ROLES', 'BRANCH_MEMBERS']).default('ALL_MEMBERS'),
  audienceRoles: z.array(z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])).default([]),
  audiencePrincipalId: z.string().optional().nullable(),
})

export async function listTodayActivities() {
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

  // An open-ended activity counts as today's only if it starts today; one with an end date
  // stays listed until that end passes.
  const windowFilter: Prisma.DailyActivityWhereInput = {
    OR: [
      { endsAt: null, startsAt: { gte: start, lte: end } },
      { endsAt: { gte: start }, startsAt: { lte: end } },
    ],
  }

  const rows = await prisma.dailyActivity.findMany({
    where: { published: true, AND: [audienceFilter, windowFilter] },
    orderBy: { startsAt: 'asc' },
    take: 40,
    include: { createdBy: { select: { fullName: true } } },
  })

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    activityType: row.activityType,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() || null,
    venue: row.venue,
    createdByName: row.createdBy.fullName,
  }))
}

export async function createDailyActivity(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'ORGANIZER', 'EXECUTIVE'])
  const parsed = activitySchema.parse({
    title: formData.get('title'),
    body: formData.get('body') || undefined,
    activityType: formData.get('activityType') || 'GENERAL',
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt') || null,
    venue: formData.get('venue') || null,
    audienceType: formData.get('audienceType') || 'ALL_MEMBERS',
    audienceRoles: formData.getAll('audienceRoles'),
    audiencePrincipalId: formData.get('audiencePrincipalId') || null,
  })

  const activity = await prisma.dailyActivity.create({
    data: {
      title: parsed.title,
      body: parsed.body,
      activityType: parsed.activityType,
      startsAt: new Date(parsed.startsAt),
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      venue: parsed.venue,
      audienceType: parsed.audienceType,
      audienceRoles: parsed.audienceRoles,
      audiencePrincipalId: parsed.audienceType === 'BRANCH_MEMBERS' ? parsed.audiencePrincipalId : null,
      createdById: actor.id,
      published: true,
    },
  })

  await writeAudit({
    userId: actor.id,
    action: 'DAILY_ACTIVITY_CREATE',
    entity: 'DailyActivity',
    entityId: activity.id,
    newValue: { title: activity.title },
  })

  revalidatePath('/today')
  revalidatePath('/dashboard/member')
  return activity
}
