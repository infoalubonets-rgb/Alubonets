'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { sendBroadcastEmail } from '@/lib/email/resend'
import { sendAnnouncement } from '@/lib/data/queries'
import { assertNotPast } from '@/lib/dates'
import { amountKes, amountKesOrZero } from '@/lib/money-limits'

function refreshEvents(eventId?: string) {
  revalidatePath('/events')
  revalidatePath('/dashboard/organizer/events')
  revalidatePath('/dashboard/member/events')
  if (eventId) {
    revalidatePath(`/events/${eventId}`)
    revalidatePath(`/dashboard/organizer/events/${eventId}`)
  }
  revalidateTag(TAGS.events)
}

async function requireEventManager() {
  return requireActiveRole(['ADMIN', 'ORGANIZER', 'SECRETARY'])
}

export async function upsertEventDetails(formData: FormData) {
  const actor = await requireEventManager()
  const data = z
    .object({
      id: z.string().optional(),
      title: z.string().trim().min(2),
      description: z.string().trim().optional(),
      location: z.string().trim().optional(),
      mapsUrl: z.string().trim().url().optional(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date().optional(),
      imageUrl: z.string().trim().optional(),
      isPublic: z.enum(['on', 'off']).optional(),
      audienceType: z.enum(['PUBLIC', 'ALL_MEMBERS', 'SELECTED_ROLES', 'SELECTED_MEMBERS', 'BRANCH_MEMBERS']),
      audiencePrincipalId: z.string().optional(),
      capacity: z.coerce.number().int().positive().max(100_000, 'Capacity cannot be more than 100,000.').optional(),
      rsvpDeadlineAt: z.coerce.date().optional(),
      budgetKes: amountKesOrZero('Budget').optional(),
      actualCostKes: amountKesOrZero('Actual cost').optional(),
      reminderOffsetsHours: z.string().optional(),
    })
    .parse({
      id: formData.get('id') || undefined,
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      location: formData.get('location') || undefined,
      mapsUrl: formData.get('mapsUrl') || undefined,
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt') || undefined,
      imageUrl: formData.get('imageUrl') || undefined,
      isPublic: formData.get('isPublic') === 'off' ? 'off' : 'on',
      audienceType: formData.get('audienceType') || 'PUBLIC',
      audiencePrincipalId: formData.get('audiencePrincipalId') || undefined,
      capacity: formData.get('capacity') || undefined,
      rsvpDeadlineAt: formData.get('rsvpDeadlineAt') || undefined,
      budgetKes: formData.get('budgetKes') || undefined,
      actualCostKes: formData.get('actualCostKes') || undefined,
      reminderOffsetsHours: formData.get('reminderOffsetsHours') || undefined,
    })
  // An event may not be scheduled in the past. An event that has already happened
  // stays editable, so only a *changed* date has to clear the bound.
  const existing = data.id ? await prisma.event.findUnique({ where: { id: data.id }, select: { startsAt: true, rsvpDeadlineAt: true } }) : null
  if (data.startsAt.getTime() !== existing?.startsAt.getTime()) assertNotPast(data.startsAt, 'Event date')
  if (data.rsvpDeadlineAt && data.rsvpDeadlineAt.getTime() !== existing?.rsvpDeadlineAt?.getTime()) assertNotPast(data.rsvpDeadlineAt, 'RSVP deadline')
  if (data.audienceType === 'BRANCH_MEMBERS' && !data.audiencePrincipalId) {
    throw new Error('Select a Principal Member for branch audience events.')
  }
  const audienceRoles = formData.getAll('audienceRoles').map(String) as Role[]
  const offsets = (data.reminderOffsetsHours || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  const payload = {
    title: data.title,
    description: data.description ?? null,
    location: data.location ?? null,
    mapsUrl: data.mapsUrl ?? null,
    startsAt: data.startsAt,
    endsAt: data.endsAt ?? null,
    imageUrl: data.imageUrl ?? null,
    isPublic: data.audienceType === 'PUBLIC' || data.isPublic !== 'off',
    audienceType: data.audienceType,
    audiencePrincipalId: data.audienceType === 'BRANCH_MEMBERS' ? data.audiencePrincipalId ?? null : null,
    audienceRoles,
    capacity: data.capacity ?? null,
    rsvpDeadlineAt: data.rsvpDeadlineAt ?? null,
    budgetKes: data.budgetKes ?? 0,
    actualCostKes: data.actualCostKes ?? 0,
    reminderOffsetsHours: offsets,
  }
  const event = data.id
    ? await prisma.event.update({ where: { id: data.id }, data: payload })
    : await prisma.event.create({ data: payload })
  await writeAudit({
    userId: actor.id,
    action: data.id ? 'EVENT_UPDATE' : 'EVENT_CREATE',
    entity: 'Event',
    entityId: event.id,
    newValue: { title: event.title, audienceType: event.audienceType },
  })
  refreshEvents(event.id)
  return event
}

export async function circulateEventInvitations(formData: FormData) {
  const actor = await requireEventManager()
  const eventId = z.string().min(1).parse(formData.get('eventId'))
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
  const selectedIds = formData.getAll('memberIds').map(String)
  const members = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(event.audienceType === 'ALL_MEMBERS'
        ? {}
        : event.audienceType === 'SELECTED_ROLES'
          ? { role: { in: event.audienceRoles } }
          : event.audienceType === 'SELECTED_MEMBERS'
            ? { id: { in: selectedIds } }
            : event.audienceType === 'BRANCH_MEMBERS' && event.audiencePrincipalId
              ? {
                  OR: [
                    { id: event.audiencePrincipalId },
                    { principalMemberId: event.audiencePrincipalId },
                  ],
                }
              : { id: '__none__' }),
    },
    select: { id: true },
  })
  if (!members.length && event.audienceType !== 'PUBLIC') {
    throw new Error('No members match this audience.')
  }
  await prisma.$transaction(async (tx) => {
    await tx.eventInvitation.deleteMany({ where: { eventId } })
    if (members.length) {
      await tx.eventInvitation.createMany({
        data: members.map((m) => ({ eventId, userId: m.id, sentAt: new Date() })),
      })
    }
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  after(async () => {
    try {
      if (members.length) {
        await sendBroadcastEmail({
          subject: `Event invitation: ${event.title}`,
          title: event.title,
          body: `<p>You are invited to <strong>${event.title}</strong>.</p><p>${event.description || ''}</p><p><strong>When:</strong> ${event.startsAt.toLocaleString()}</p>`,
          ctaLabel: 'View event & RSVP',
          ctaUrl: `${appUrl}/events/${event.id}`,
          template: 'event_invitation',
          actorId: actor.id,
          memberIds: members.map((m) => m.id),
        })
        await sendAnnouncement({
          authorId: actor.id,
          title: `Event invitation: ${event.title}`,
          content: `You are invited. Starts ${event.startsAt.toLocaleString()}.`,
          broadcast: false,
          memberIds: members.map((m) => m.id),
        })
      }
    } catch (e) {
      console.error(e)
    }
  })
  await writeAudit({
    userId: actor.id,
    action: 'EVENT_INVITE',
    entity: 'Event',
    entityId: eventId,
    newValue: { recipients: members.length },
  })
  refreshEvents(eventId)
}

export async function submitEventRsvp(formData: FormData) {
  const actor = await requireActiveRole([
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
    'MEMBER',
  ])
  const data = z
    .object({
      eventId: z.string().min(1),
      status: z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
      note: z.string().trim().max(500).optional(),
    })
    .parse({
      eventId: formData.get('eventId'),
      status: formData.get('status'),
      note: formData.get('note') || undefined,
    })
  const event = await prisma.event.findUniqueOrThrow({ where: { id: data.eventId } })
  if (event.rsvpDeadlineAt && event.rsvpDeadlineAt < new Date()) {
    throw new Error('RSVP deadline has passed.')
  }
  if (data.status === 'GOING' && event.capacity) {
    const going = await prisma.eventRSVP.count({
      where: { eventId: data.eventId, status: 'GOING', NOT: { userId: actor.id } },
    })
    if (going >= event.capacity) throw new Error('This event is at capacity.')
  }
  await prisma.eventRSVP.upsert({
    where: { eventId_userId: { eventId: data.eventId, userId: actor.id } },
    create: {
      eventId: data.eventId,
      userId: actor.id,
      status: data.status,
      note: data.note,
    },
    update: { status: data.status, note: data.note, respondedAt: new Date() },
  })
  await writeAudit({
    userId: actor.id,
    action: 'EVENT_RSVP',
    entity: 'EventRSVP',
    entityId: data.eventId,
    newValue: { status: data.status },
  })
  refreshEvents(data.eventId)
}

export async function deleteEventFromMemberView(eventId: string) {
  const actor = await requireActiveRole(['ADMIN', 'ORGANIZER', 'SECRETARY'])
  const canDeleteAny = actor.isSuperAdmin || actor.role === 'ADMIN'
  if (!canDeleteAny) {
    const creationLog = await prisma.auditLog.findFirst({
      where: { action: 'EVENT_CREATE', entity: 'Event', entityId: eventId, userId: actor.id },
      select: { id: true },
    })
    if (!creationLog) throw new Error('You can only delete events you created.')
  }
  await prisma.event.delete({ where: { id: eventId } })
  await writeAudit({ userId: actor.id, action: 'EVENT_DELETE', entity: 'Event', entityId: eventId })
  refreshEvents(eventId)
}

export async function recordEventAttendance(formData: FormData) {
  const actor = await requireEventManager()
  const data = z
    .object({
      eventId: z.string().min(1),
      userId: z.string().min(1),
      present: z.enum(['true', 'false']),
    })
    .parse({
      eventId: formData.get('eventId'),
      userId: formData.get('userId'),
      present: formData.get('present') === 'false' ? 'false' : 'true',
    })
  await prisma.eventAttendance.upsert({
    where: { eventId_userId: { eventId: data.eventId, userId: data.userId } },
    create: {
      eventId: data.eventId,
      userId: data.userId,
      present: data.present === 'true',
      recordedById: actor.id,
    },
    update: { present: data.present === 'true', recordedById: actor.id, recordedAt: new Date() },
  })
  await writeAudit({
    userId: actor.id,
    action: 'EVENT_ATTENDANCE',
    entity: 'EventAttendance',
    entityId: data.eventId,
    newValue: { userId: data.userId, present: data.present === 'true' },
  })
  refreshEvents(data.eventId)
}

export async function addEventCost(formData: FormData) {
  const actor = await requireEventManager()
  const data = z
    .object({
      eventId: z.string().min(1),
      label: z.string().trim().min(2),
      amount: amountKes(),
      notes: z.string().trim().max(500).optional(),
    })
    .parse({
      eventId: formData.get('eventId'),
      label: formData.get('label'),
      amount: formData.get('amount'),
      notes: formData.get('notes') || undefined,
    })
  const cost = await prisma.eventCost.create({
    data: { ...data, recordedById: actor.id },
  })
  const sum = await prisma.eventCost.aggregate({
    where: { eventId: data.eventId },
    _sum: { amount: true },
  })
  await prisma.event.update({
    where: { id: data.eventId },
    data: { actualCostKes: sum._sum.amount ?? 0 },
  })
  await writeAudit({
    userId: actor.id,
    action: 'EVENT_COST_ADD',
    entity: 'EventCost',
    entityId: cost.id,
    newValue: data,
  })
  refreshEvents(data.eventId)
}

export async function addEventAttachment(formData: FormData) {
  const actor = await requireEventManager()
  const data = z
    .object({
      eventId: z.string().min(1),
      title: z.string().trim().min(2),
      fileUrl: z.string().url(),
    })
    .parse({
      eventId: formData.get('eventId'),
      title: formData.get('title'),
      fileUrl: formData.get('fileUrl'),
    })
  const row = await prisma.eventAttachment.create({ data })
  await writeAudit({
    userId: actor.id,
    action: 'EVENT_ATTACHMENT_ADD',
    entity: 'EventAttachment',
    entityId: row.id,
    newValue: data,
  })
  refreshEvents(data.eventId)
}

export async function publishEventReport(formData: FormData) {
  const actor = await requireEventManager()
  const data = z
    .object({
      eventId: z.string().min(1),
      reportBody: z.string().trim().min(5),
    })
    .parse({
      eventId: formData.get('eventId'),
      reportBody: formData.get('reportBody'),
    })
  await prisma.event.update({
    where: { id: data.eventId },
    data: { reportBody: data.reportBody, reportPublishedAt: new Date() },
  })
  await writeAudit({
    userId: actor.id,
    action: 'EVENT_REPORT_PUBLISH',
    entity: 'Event',
    entityId: data.eventId,
  })
  refreshEvents(data.eventId)
}
