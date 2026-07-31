'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireActiveRole } from '@/lib/auth/session'
import { TAGS, createMeeting, updateMeeting } from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'
import { buildMeetingMinutesPdf, minutesFilename } from '@/lib/pdf/minutes'
import { createServerClient } from '@/lib/supabase-server'
import { writeAudit } from '@/lib/audit'

function revalidateMeetings() {
  revalidatePath('/dashboard/secretary')
  revalidatePath('/dashboard/secretary/meetings')
  revalidatePath('/dashboard/member')
  revalidateTag(TAGS.meetings)
}

const meetingFields = z.object({
  title: z.string().min(1),
  heldAt: z.string().min(1),
  attendance: z.coerce.number().int().min(0).default(0),
  opening: z.string().optional().nullable(),
  attendees: z.string().optional().nullable(),
  membersAbsent: z.string().optional().nullable(),
  membersApology: z.string().optional().nullable(),
  aob: z.string().optional().nullable(),
  agenda: z.string().optional().nullable(),
  minutes: z.string().optional().nullable(),
  nextMeetingAt: z.string().optional().nullable(),
})

function emptyToNull(v: string | null | undefined) {
  const t = v?.trim()
  return t ? t : null
}

function parseNextMeeting(raw: string | null | undefined) {
  const t = raw?.trim()
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function actionCreateMeeting(formData: FormData) {
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const parsed = meetingFields.parse({
    title: formData.get('title'),
    heldAt: formData.get('heldAt'),
    attendance: formData.get('attendance') || 0,
    opening: formData.get('opening'),
    attendees: formData.get('attendees'),
    membersAbsent: formData.get('membersAbsent'),
    membersApology: formData.get('membersApology'),
    aob: formData.get('aob'),
    agenda: formData.get('agenda'),
    minutes: formData.get('minutes'),
    nextMeetingAt: formData.get('nextMeetingAt'),
  })

  const meeting = await createMeeting({
    title: parsed.title.trim(),
    heldAt: new Date(parsed.heldAt),
    attendance: parsed.attendance,
    opening: emptyToNull(parsed.opening) ?? undefined,
    attendees: emptyToNull(parsed.attendees) ?? undefined,
    membersAbsent: emptyToNull(parsed.membersAbsent) ?? undefined,
    membersApology: emptyToNull(parsed.membersApology) ?? undefined,
    aob: emptyToNull(parsed.aob) ?? undefined,
    agenda: emptyToNull(parsed.agenda) ?? undefined,
    minutes: emptyToNull(parsed.minutes) ?? undefined,
    nextMeetingAt: parseNextMeeting(parsed.nextMeetingAt) ?? undefined,
    recordedBy: actor.id,
    status: 'DRAFT',
  })

  await writeAudit({
    userId: actor.id,
    action: 'MEETING_CREATE',
    entity: 'Meeting',
    entityId: meeting.id,
  })

  revalidateMeetings()
  return meeting
}

export async function actionUpdateMeeting(formData: FormData) {
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Meeting id required')

  const existing = await prisma.meeting.findUnique({ where: { id } })
  if (!existing) throw new Error('Meeting not found')
  if (existing.status === 'FINAL') throw new Error('Final minutes are locked. Create a new minutes version before editing.')

  const parsed = meetingFields.parse({
    title: formData.get('title'),
    heldAt: formData.get('heldAt'),
    attendance: formData.get('attendance') || 0,
    opening: formData.get('opening'),
    attendees: formData.get('attendees'),
    membersAbsent: formData.get('membersAbsent'),
    membersApology: formData.get('membersApology'),
    aob: formData.get('aob'),
    agenda: formData.get('agenda'),
    minutes: formData.get('minutes'),
    nextMeetingAt: formData.get('nextMeetingAt'),
  })

  const updated = await updateMeeting(id, {
    title: parsed.title.trim(),
    heldAt: new Date(parsed.heldAt),
    attendance: parsed.attendance,
    opening: emptyToNull(parsed.opening),
    attendees: emptyToNull(parsed.attendees),
    membersAbsent: emptyToNull(parsed.membersAbsent),
    membersApology: emptyToNull(parsed.membersApology),
    aob: emptyToNull(parsed.aob),
    agenda: emptyToNull(parsed.agenda),
    minutes: emptyToNull(parsed.minutes),
    nextMeetingAt: parseNextMeeting(parsed.nextMeetingAt),
  })

  await writeAudit({
    userId: actor.id,
    action: 'MEETING_UPDATE',
    entity: 'Meeting',
    entityId: id,
  })

  revalidateMeetings()
  revalidatePath(`/dashboard/secretary/meetings/${id}`)
  return updated
}

export async function actionPublishMeetingMinutes(meetingId: string) {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE'])
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      recorder: { select: { fullName: true, email: true } },
      agendaItems: { orderBy: { position: 'asc' } },
      actionPoints: { include: { owner: { select: { fullName: true } } } },
      decisions: { orderBy: { decidedAt: 'asc' } },
    },
  })
  if (!meeting) throw new Error('Meeting not found')
  if (meeting.status !== 'PENDING_APPROVAL') throw new Error('Minutes must be submitted for approval first.')

  const hasContent =
    Boolean(meeting.minutes?.trim()) ||
    Boolean(meeting.agenda?.trim()) ||
    Boolean(meeting.opening?.trim())
  if (!hasContent) {
    throw new Error('Add agenda or minutes before publishing')
  }

  const bytes = await buildMeetingMinutesPdf(meeting)
  const filename = minutesFilename(meeting)
  const storagePath = `minutes/${meeting.id}/v${meeting.minutesVersion}-${crypto.randomUUID()}.pdf`

  const supabase = createServerClient()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, Buffer.from(bytes), {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

  // Prefer signed URL; fall back to path for app-relative storage reference
  const fileUrl = `storage://documents/${storagePath}`

  const { findCategoryIdByName } = await import('@/lib/document-categories')
  const minutesCategoryId = await findCategoryIdByName('Minutes')

  let documentId = meeting.publishedDocumentId
  if (documentId && meeting.minutesVersion < 0) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        title: `Minutes — ${meeting.title}`,
        fileUrl,
        category: 'Minutes',
        categoryId: minutesCategoryId,
      },
    })
  } else {
    const doc = await prisma.document.create({
      data: {
        title: `Minutes — ${meeting.title}`,
        fileUrl,
        category: 'Minutes',
        categoryId: minutesCategoryId,
        uploadedBy: actor.id,
        versionGroupId: `meeting-${meeting.id}`,
        version: meeting.minutesVersion,
        previousVersionId: documentId ?? undefined,
        storagePath,
        mimeType: 'application/pdf',
        accessLevel: 'MEMBERS',
        status: 'PUBLISHED',
        effectiveAt: new Date(),
      },
    })
    documentId = doc.id
  }

  await updateMeeting(meetingId, {
    status: 'FINAL',
    publishedDocumentId: documentId,
    approvedById: actor.id,
    approvedAt: new Date(),
  })

  await writeAudit({
    userId: actor.id,
    action: 'MEETING_PUBLISH',
    entity: 'Meeting',
    entityId: meetingId,
    reason: 'Approved and published final minutes to document repository',
    oldValue: { status: meeting.status, publishedDocumentId: meeting.publishedDocumentId },
    newValue: { status: 'FINAL', documentId, storagePath, filename },
  })

  revalidateMeetings()
  revalidatePath(`/dashboard/secretary/meetings/${meetingId}`)
  return { documentId, fileUrl }
}

export async function actionDeleteMeeting(id: string) {
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { id: true, status: true, title: true },
  })
  if (!meeting) throw new Error('Meeting not found')
  if (meeting.status !== 'DRAFT') {
    throw new Error('Only draft meetings can be deleted')
  }

  await prisma.meeting.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'MEETING_DELETE',
    entity: 'Meeting',
    entityId: id,
    meta: { title: meeting.title },
  })
  revalidateMeetings()
}

export async function actionDeleteMeetings(ids: string[]) {
  if (!ids.length) return
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const drafts = await prisma.meeting.findMany({
    where: { id: { in: ids }, status: 'DRAFT' },
    select: { id: true, title: true },
  })
  if (drafts.length !== ids.length) {
    throw new Error('Only draft meetings can be deleted')
  }

  await prisma.meeting.deleteMany({
    where: { id: { in: drafts.map((meeting) => meeting.id) }, status: 'DRAFT' },
  })
  await Promise.all(
    drafts.map((meeting) =>
      writeAudit({
        userId: actor.id,
        action: 'MEETING_DELETE',
        entity: 'Meeting',
        entityId: meeting.id,
        meta: { title: meeting.title },
      })
    )
  )
  revalidateMeetings()
}
