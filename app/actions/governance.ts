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
import { governanceCommentSchema } from '@/lib/governance-comment'
import { assertNotPast } from '@/lib/dates'
import { createServerClient } from '@/lib/supabase-server'
import { createSignedUpload } from '@/lib/upload-signed'

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
  const actor = await requireActiveRole(['ADMIN','SECRETARY','EXECUTIVE','TREASURER','ORGANIZER','MEMBER','AUDITOR'])
  await prisma.meetingInvitation.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  })
}

const refreshResolutions = () => {
  revalidatePath('/governance')
  revalidatePath('/governance/manage')
}

const RESOLUTION_CREATOR_ROLES = ['ADMIN', 'SECRETARY'] as const

const RESOLUTION_DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'] as const

/**
 * Step 1 of a fast upload: validate + authorize, then hand back a signed URL the
 * browser can upload straight to Supabase Storage with (no file bytes touch this server).
 * Images → public `gallery`; documents (PDF/Word/Excel) → private `documents`.
 */
export async function requestResolutionUploadUrl(formData: FormData) {
  await requireActiveRole([...RESOLUTION_CREATOR_ROLES])
  const kind = z.enum(['image', 'document']).parse(formData.get('kind'))
  const fileName = z.string().min(1).parse(formData.get('fileName'))

  if (kind === 'image') {
    const ext = (fileName.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `resolutions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    return createSignedUpload('gallery', path)
  }

  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  if (!RESOLUTION_DOC_EXTS.includes(ext as (typeof RESOLUTION_DOC_EXTS)[number])) {
    throw new Error('Document must be a PDF, Word, Excel, or CSV file.')
  }
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `resolutions/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`
  return createSignedUpload('documents', path)
}

export async function createResolution(formData: FormData) {
  const actor = await requireActiveRole([...RESOLUTION_CREATOR_ROLES])
  const title = z.string().trim().min(3).max(200).parse(formData.get('title'))
  const body = z.string().trim().min(5).max(6000).parse(formData.get('body'))
  const category = z.enum(GOVERNANCE_CATEGORIES.map((item) => item.value) as [string, ...string[]]).parse(
    formData.get('category') || 'RESOLUTION',
  )
  const imagePath = z.string().optional().parse(formData.get('imagePath') || undefined)
  const documentPath = z.string().optional().parse(formData.get('documentPath') || undefined)
  const documentName = z.string().optional().parse(formData.get('documentName') || undefined)

  const supabase = createServerClient()
  const imageUrl = imagePath ? supabase.storage.from('gallery').getPublicUrl(imagePath).data.publicUrl : undefined
  // Private documents bucket — download via /api/governance/resolutions/[id]/document
  const documentUrl = documentPath ? `storage://documents/${documentPath}` : undefined

  const resolution = await prisma.resolution.create({
    data: { title, body, category, imageUrl, documentUrl, documentName, createdById: actor.id },
  })
  await writeAudit({ userId: actor.id, action: 'RESOLUTION_CREATE', entity: 'Resolution', entityId: resolution.id, newValue: { title } })
  refreshResolutions()
  return { id: resolution.id, title: resolution.title }
}

export async function decideResolution(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const decision = z.enum(['approve', 'reject']).parse(formData.get('decision'))
  const visibleToRoles = formData.getAll('visibleToRoles').map(String) as Role[]
  const allowAnonymous = formData.get('allowAnonymous') === 'true'
  const allowComments = formData.get('allowComments') === 'true'
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
      allowAnonymous: decision === 'approve' ? allowAnonymous : true,
      allowComments: decision === 'approve' ? allowComments : true,
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
    newValue: { status: updated.status, visibleToRoles: updated.visibleToRoles, allowAnonymous: updated.allowAnonymous, allowComments: updated.allowComments },
  })
  refreshResolutions()
}

export async function updateResolutionVisibility(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const visibleToRoles = formData.getAll('visibleToRoles').map(String) as Role[]
  if (visibleToRoles.length === 0) {
    throw new Error('Select at least one dashboard to show this on.')
  }
  const allowAnonymous = formData.get('allowAnonymous') === 'true'
  const allowComments = formData.get('allowComments') === 'true'

  const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id } })
  if (resolution.status !== 'APPROVED') throw new Error('Only approved proposals have visibility settings to edit.')

  const updated = await prisma.resolution.update({
    where: { id },
    data: { visibleToRoles, allowAnonymous, allowComments },
  })
  await writeAudit({
    userId: actor.id,
    action: 'RESOLUTION_VISIBILITY_UPDATE',
    entity: 'Resolution',
    entityId: id,
    newValue: { visibleToRoles: updated.visibleToRoles, allowAnonymous: updated.allowAnonymous, allowComments: updated.allowComments },
  })
  refreshResolutions()
}

export async function voteResolution(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE', 'TREASURER', 'ORGANIZER', 'MEMBER'])
  const resolutionId = z.string().min(1).parse(formData.get('resolutionId'))
  const vote = z.enum(['APPROVE', 'REJECT']).parse(formData.get('vote'))
  const commentRaw = String(formData.get('comment') || '').trim()
  const comment = commentRaw ? governanceCommentSchema.parse(commentRaw) : null
  const anonymous = formData.get('anonymous') === 'true'

  const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } })
  if (resolution.status !== 'APPROVED') throw new Error('This resolution is not open for responses.')
  const canSee = actor.role === 'ADMIN' || actor.role === 'SECRETARY' || resolution.visibleToRoles.includes(actor.role)
  if (!canSee) throw new Error('This resolution is not visible to your role.')
  if (anonymous && !resolution.allowAnonymous) throw new Error('Anonymous responses are not allowed for this proposal.')
  if (comment && !resolution.allowComments) throw new Error('Comments are not allowed for this proposal.')
  const savedComment = resolution.allowComments ? comment : null

  const existing = await prisma.resolutionResponse.findUnique({
    where: { resolutionId_userId: { resolutionId, userId: actor.id } },
    select: { id: true },
  })
  if (existing) {
    throw new Error('You have already submitted a response. Votes cannot be changed.')
  }

  await prisma.resolutionResponse.create({
    data: { resolutionId, userId: actor.id, vote, comment: savedComment, anonymous },
  })
  // Audit + cache refresh should not block the voter’s success UI longer than necessary
  void writeAudit({
    userId: actor.id,
    action: 'RESOLUTION_VOTE',
    entity: 'Resolution',
    entityId: resolutionId,
    newValue: { vote, anonymous },
  }).catch(() => undefined)
  revalidatePath(`/governance/${resolutionId}`)
  revalidatePath('/governance')
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
