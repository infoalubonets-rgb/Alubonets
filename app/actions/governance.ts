'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { sendBroadcastEmail } from '@/lib/email/resend'
import { TAGS } from '@/lib/data/queries'
import { GOVERNANCE_CATEGORIES } from '@/lib/governance-categories'
import { assertNotPast } from '@/lib/dates'
import { createServerClient } from '@/lib/supabase-server'

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
  assertNotPast(data.dueAt, 'Action point due date')
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

const refreshResolutions = () => {
  revalidatePath('/governance')
  revalidatePath('/governance/manage')
}

export async function createResolution(formData: FormData) {
  const actor = await requireActiveRole(['SECRETARY', 'ORGANIZER', 'TREASURER', 'ADMIN'])
  const title = z.string().trim().min(3).max(200).parse(formData.get('title'))
  const body = z.string().trim().min(5).max(6000).parse(formData.get('body'))
  const category = z.enum(GOVERNANCE_CATEGORIES.map((item) => item.value) as [string, ...string[]]).parse(
    formData.get('category') || 'RESOLUTION',
  )

  const supabase = createServerClient()
  const imageFile = formData.get('image') as File | null
  const documentFile = formData.get('document') as File | null

  let imageUrl: string | undefined
  if (imageFile && imageFile.size > 0) {
    if (!imageFile.type.startsWith('image/')) throw new Error('Attachment must be an image file.')
    const ext = (imageFile.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `resolutions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('gallery').upload(path, await imageFile.arrayBuffer(), { contentType: imageFile.type, upsert: false })
    if (error) throw new Error(`Image upload failed: ${error.message}`)
    imageUrl = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl
  }

  let documentUrl: string | undefined
  let documentName: string | undefined
  if (documentFile && documentFile.size > 0) {
    const ext = (documentFile.name.split('.').pop() ?? '').toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext)) throw new Error('Document must be a PDF or Word file.')
    const safe = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `resolutions/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`
    const { error } = await supabase.storage.from('gallery').upload(path, await documentFile.arrayBuffer(), { contentType: documentFile.type || 'application/octet-stream', upsert: false })
    if (error) throw new Error(`Document upload failed: ${error.message}`)
    documentUrl = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl
    documentName = documentFile.name
  }

  const resolution = await prisma.resolution.create({
    data: { title, body, category, imageUrl, documentUrl, documentName, createdById: actor.id },
  })
  await writeAudit({ userId: actor.id, action: 'RESOLUTION_CREATE', entity: 'Resolution', entityId: resolution.id, newValue: { title } })
  refreshResolutions()
}

export async function decideResolution(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const decision = z.enum(['approve', 'reject']).parse(formData.get('decision'))
  const visibleToRoles = formData.getAll('visibleToRoles').map(String) as Role[]
  const reason = String(formData.get('reason') || '').trim()

  const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id } })
  if (resolution.status !== 'PENDING_APPROVAL') throw new Error('This resolution has already been decided.')
  if (decision === 'approve' && visibleToRoles.length === 0) {
    throw new Error('Select at least one dashboard to show this on.')
  }
  if (decision === 'reject' && reason.length < 3) {
    throw new Error('Provide a reason for rejecting this resolution.')
  }

  const updated = await prisma.resolution.update({
    where: { id },
    data: {
      status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
      visibleToRoles: decision === 'approve' ? visibleToRoles : [],
      decidedById: actor.id,
      decidedAt: new Date(),
      rejectionReason: decision === 'reject' ? reason : null,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: decision === 'approve' ? 'RESOLUTION_APPROVE' : 'RESOLUTION_REJECT',
    entity: 'Resolution',
    entityId: id,
    reason: reason || undefined,
    newValue: { status: updated.status, visibleToRoles: updated.visibleToRoles },
  })
  refreshResolutions()
}

export async function voteResolution(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE', 'TREASURER', 'ORGANIZER', 'MEMBER'])
  const resolutionId = z.string().min(1).parse(formData.get('resolutionId'))
  const vote = z.enum(['APPROVE', 'REJECT']).parse(formData.get('vote'))
  const comment = String(formData.get('comment') || '').trim().slice(0, 2000) || null
  const anonymous = formData.get('anonymous') === 'true'

  const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } })
  if (resolution.status !== 'APPROVED') throw new Error('This resolution is not open for responses.')
  const canSee = actor.role === 'ADMIN' || actor.role === 'SECRETARY' || resolution.visibleToRoles.includes(actor.role)
  if (!canSee) throw new Error('This resolution is not visible to your role.')

  await prisma.resolutionResponse.upsert({
    where: { resolutionId_userId: { resolutionId, userId: actor.id } },
    create: { resolutionId, userId: actor.id, vote, comment, anonymous },
    update: { vote, comment, anonymous },
  })
  await writeAudit({ userId: actor.id, action: 'RESOLUTION_VOTE', entity: 'Resolution', entityId: resolutionId, newValue: { vote, anonymous } })
  revalidatePath('/governance')
  revalidatePath(`/governance/${resolutionId}`)
}

export async function publishResolutionResults(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id } })
  if (resolution.status !== 'APPROVED') throw new Error('Only approved resolutions can be published.')
  await prisma.resolution.update({
    where: { id },
    data: { resultsPublished: true, publishedById: actor.id, publishedAt: new Date() },
  })
  await writeAudit({ userId: actor.id, action: 'RESOLUTION_PUBLISH', entity: 'Resolution', entityId: id })
  revalidatePath('/governance')
}
