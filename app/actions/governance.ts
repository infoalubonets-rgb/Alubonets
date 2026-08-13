'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { sendBroadcastEmail } from '@/lib/email/resend'
import { TAGS } from '@/lib/data/queries'

const refresh = (id?: string) => {
  revalidatePath('/governance')
  revalidatePath('/governance/manage')
  revalidatePath('/dashboard/secretary/meetings')
  if (id) revalidatePath(`/dashboard/secretary/meetings/${id}`)
  revalidateTag(TAGS.meetings)
}

export async function circulateMeetingNotice(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const meetingId = z.string().min(1).parse(formData.get('meetingId'))
  const noticeBody = z.string().trim().min(5).max(4000).parse(formData.get('noticeBody'))
  const audienceType = z.enum(['ALL_MEMBERS','SELECTED_ROLES','SELECTED_MEMBERS','MIXED']).parse(formData.get('audienceType'))
  const audienceRoles = formData.getAll('audienceRoles').map(String) as Role[]
  const selectedIds = formData.getAll('memberIds').map(String)
  const members = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(audienceType === 'ALL_MEMBERS' ? {} : audienceType === 'SELECTED_ROLES' ? { role: { in: audienceRoles } } :
        audienceType === 'SELECTED_MEMBERS' ? { id: { in: selectedIds } } :
        { OR: [{ role: { in: audienceRoles } }, { id: { in: selectedIds } }] }),
    },
    select: { id: true },
  })
  if (!members.length) throw new Error('The selected audience has no active members.')
  const meeting = await prisma.$transaction(async (tx) => {
    const updated = await tx.meeting.update({ where: { id: meetingId }, data: { noticeBody, audienceType, audienceRoles, noticeSentAt: new Date(), status: 'NOTICE' } })
    await tx.meetingInvitation.deleteMany({ where: { meetingId } })
    await tx.meetingInvitation.createMany({ data: members.map((member) => ({ meetingId, userId: member.id, sentAt: new Date() })) })
    return updated
  })
  await sendBroadcastEmail({ subject: `Meeting notice: ${meeting.title}`, title: meeting.title, body: `<p>${noticeBody.replaceAll('<','&lt;').replaceAll('>','&gt;')}</p><p><strong>Date:</strong> ${meeting.heldAt.toLocaleString()}</p>`, ctaLabel: 'View meetings and reports', ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/meetings-reports`, template: 'meeting_notice', actorId: actor.id, memberIds: members.map((m) => m.id) })
  await writeAudit({ userId: actor.id, action: 'MEETING_NOTICE_CIRCULATE', entity: 'Meeting', entityId: meetingId, newValue: { audienceType, audienceRoles, recipients: members.length, noticeBody } })
  refresh(meetingId)
}

export async function addAgendaItem(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const data = z.object({ meetingId: z.string().min(1), title: z.string().trim().min(2), description: z.string().trim().optional() }).parse(Object.fromEntries(formData))
  const position = await prisma.meetingAgendaItem.count({ where: { meetingId: data.meetingId } }) + 1
  const item = await prisma.meetingAgendaItem.create({ data: { ...data, position } })
  await writeAudit({ userId: actor.id, action: 'MEETING_AGENDA_ADD', entity: 'MeetingAgendaItem', entityId: item.id, newValue: data })
  refresh(data.meetingId)
}

export async function addActionPoint(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const data = z.object({ meetingId: z.string().min(1), title: z.string().trim().min(2), description: z.string().trim().optional(), ownerId: z.string().min(1), dueAt: z.coerce.date().optional() }).parse({
    meetingId: formData.get('meetingId'), title: formData.get('title'), description: formData.get('description') || undefined,
    ownerId: formData.get('ownerId'), dueAt: formData.get('dueAt') || undefined,
  })
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: data.ownerId }, include: { memberProfile: true } })
  const committee = owner.role !== 'MEMBER' || owner.memberProfile?.memberCategory === 'COMMITTEE_MEMBER'
  if (!committee) throw new Error('Action points can only be assigned to committee members.')
  const point = await prisma.meetingActionPoint.create({ data: { ...data, createdById: actor.id } })
  await writeAudit({ userId: actor.id, action: 'ACTION_POINT_CREATE', entity: 'MeetingActionPoint', entityId: point.id, newValue: data })
  refresh(data.meetingId)
}

export async function updateActionPointStatus(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','EXECUTIVE','TREASURER','ORGANIZER','MEMBER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const status = z.enum(['OPEN','IN_PROGRESS','COMPLETED','OVERDUE','CANCELLED']).parse(formData.get('status'))
  const reason = z.string().trim().min(3).max(500).parse(formData.get('reason'))
  const old = await prisma.meetingActionPoint.findUniqueOrThrow({ where: { id } })
  if (actor.role !== 'ADMIN' && actor.role !== 'SECRETARY' && old.ownerId !== actor.id) throw new Error('Only the owner, Admin or Secretary can update this action point.')
  const updated = await prisma.meetingActionPoint.update({ where: { id }, data: { status, completedAt: status === 'COMPLETED' ? new Date() : null } })
  await writeAudit({ userId: actor.id, action: 'ACTION_POINT_STATUS', entity: 'MeetingActionPoint', entityId: id, reason, oldValue: { status: old.status }, newValue: { status: updated.status } })
  refresh(old.meetingId)
}

export async function addMeetingDecision(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const data = z.object({ meetingId: z.string().min(1), reference: z.string().trim().min(2).max(60), title: z.string().trim().min(2), decision: z.string().trim().min(5), decidedAt: z.coerce.date() }).parse(Object.fromEntries(formData))
  const decision = await prisma.meetingDecision.create({ data: { ...data, createdById: actor.id } })
  await writeAudit({ userId: actor.id, action: 'MEETING_DECISION_CREATE', entity: 'MeetingDecision', entityId: decision.id, newValue: data })
  refresh(data.meetingId)
}

export async function submitMinutesForApproval(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const meetingId = z.string().min(1).parse(formData.get('meetingId'))
  const reason = z.string().trim().min(3).max(500).parse(formData.get('reason'))
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } })
  await prisma.$transaction([
    prisma.meetingVersion.create({
      data: {
        meetingId,
        version: meeting.minutesVersion,
        reason,
        createdById: actor.id,
        snapshot: {
          title: meeting.title,
          agenda: meeting.agenda,
          minutes: meeting.minutes,
          resolutions: meeting.resolutions,
          opening: meeting.opening,
          aob: meeting.aob,
          heldAt: meeting.heldAt,
          status: meeting.status,
        },
      },
    }),
    prisma.meeting.update({ where: { id: meetingId }, data: { status: 'PENDING_APPROVAL' } }),
  ])
  await writeAudit({ userId: actor.id, action: 'MINUTES_SUBMIT_APPROVAL', entity: 'Meeting', entityId: meetingId, reason, oldValue: { status: meeting.status }, newValue: { status: 'PENDING_APPROVAL', version: meeting.minutesVersion } })
  refresh(meetingId)
}

export async function createMinutesRevision(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const meetingId = z.string().min(1).parse(formData.get('meetingId'))
  const reason = z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: { agendaItems: true, actionPoints: true, decisions: true },
  })
  if (meeting.status !== 'FINAL') throw new Error('Only final minutes require a new revision.')
  const updated = await prisma.$transaction(async (tx) => {
    await tx.meetingVersion.create({
      data: {
        meetingId,
        version: meeting.minutesVersion,
        reason,
        createdById: actor.id,
        snapshot: {
          title: meeting.title,
          agenda: meeting.agenda,
          minutes: meeting.minutes,
          resolutions: meeting.resolutions,
          heldAt: meeting.heldAt,
          agendaItems: meeting.agendaItems,
          actionPoints: meeting.actionPoints,
          decisions: meeting.decisions,
        },
      },
    })
    return tx.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'DRAFT',
        minutesVersion: { increment: 1 },
        approvedAt: null,
        approvedById: null,
      },
    })
  })
  await writeAudit({
    userId: actor.id,
    action: 'MINUTES_REVISION_CREATE',
    entity: 'Meeting',
    entityId: meetingId,
    reason,
    oldValue: { status: meeting.status, version: meeting.minutesVersion },
    newValue: { status: updated.status, version: updated.minutesVersion },
  })
  refresh(meetingId)
}

export async function markMeetingNoticesRead() {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','EXECUTIVE','TREASURER','ORGANIZER','MEMBER'])
  await prisma.meetingInvitation.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  })
}
