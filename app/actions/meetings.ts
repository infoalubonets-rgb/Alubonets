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
  location: z.string().optional().nullable(),
  opening: z.string().optional().nullable(),
  attendees: z.string().optional().nullable(),
  membersAbsent: z.string().optional().nullable(),
  membersApology: z.string().optional().nullable(),
  aob: z.string().optional().nullable(),
  agenda: z.string().optional().nullable(),
  minutes: z.string().optional().nullable(),
  resolutions: z.string().optional().nullable(),
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
    location: formData.get('location'),
    opening: formData.get('opening'),
    attendees: formData.get('attendees'),
    membersAbsent: formData.get('membersAbsent'),
    membersApology: formData.get('membersApology'),
    aob: formData.get('aob'),
    agenda: formData.get('agenda'),
    minutes: formData.get('minutes'),
    resolutions: formData.get('resolutions'),
    nextMeetingAt: formData.get('nextMeetingAt'),
  })

  const meeting = await createMeeting({
    title: parsed.title.trim(),
    heldAt: new Date(parsed.heldAt),
    attendance: parsed.attendance,
    location: emptyToNull(parsed.location) ?? undefined,
    opening: emptyToNull(parsed.opening) ?? undefined,
    attendees: emptyToNull(parsed.attendees) ?? undefined,
    membersAbsent: emptyToNull(parsed.membersAbsent) ?? undefined,
    membersApology: emptyToNull(parsed.membersApology) ?? undefined,
    aob: emptyToNull(parsed.aob) ?? undefined,
    agenda: emptyToNull(parsed.agenda) ?? undefined,
    minutes: emptyToNull(parsed.minutes) ?? undefined,
    resolutions: emptyToNull(parsed.resolutions) ?? undefined,
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

  const parsed = meetingFields.parse({
    title: formData.get('title'),
    heldAt: formData.get('heldAt'),
    attendance: formData.get('attendance') || 0,
    location: formData.get('location'),
    opening: formData.get('opening'),
    attendees: formData.get('attendees'),
    membersAbsent: formData.get('membersAbsent'),
    membersApology: formData.get('membersApology'),
    aob: formData.get('aob'),
    agenda: formData.get('agenda'),
    minutes: formData.get('minutes'),
    resolutions: formData.get('resolutions'),
    nextMeetingAt: formData.get('nextMeetingAt'),
  })

  const updated = await updateMeeting(id, {
    title: parsed.title.trim(),
    heldAt: new Date(parsed.heldAt),
    attendance: parsed.attendance,
    location: emptyToNull(parsed.location),
    opening: emptyToNull(parsed.opening),
    attendees: emptyToNull(parsed.attendees),
    membersAbsent: emptyToNull(parsed.membersAbsent),
    membersApology: emptyToNull(parsed.membersApology),
    aob: emptyToNull(parsed.aob),
    agenda: emptyToNull(parsed.agenda),
    minutes: emptyToNull(parsed.minutes),
    resolutions: emptyToNull(parsed.resolutions),
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
  const actor = await requireActiveRole(['SECRETARY', 'ADMIN'])
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { recorder: { select: { fullName: true, email: true } } },
  })
  if (!meeting) throw new Error('Meeting not found')

  const hasContent =
    Boolean(meeting.minutes?.trim()) ||
    Boolean(meeting.agenda?.trim()) ||
    Boolean(meeting.resolutions?.trim()) ||
    Boolean(meeting.opening?.trim())
  if (!hasContent) {
    throw new Error('Add agenda, minutes, or resolutions before publishing')
  }

  const bytes = await buildMeetingMinutesPdf(meeting)
  const filename = minutesFilename(meeting)
  const storagePath = `minutes/${meeting.id}.pdf`

  const supabase = createServerClient()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, Buffer.from(bytes), {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

  // Prefer signed URL; fall back to path for app-relative storage reference
  const fileUrl = !signError && signed?.signedUrl ? signed.signedUrl : `storage://documents/${storagePath}`

  let documentId = meeting.publishedDocumentId
  if (documentId) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        title: `Minutes — ${meeting.title}`,
        fileUrl,
        category: 'Minutes',
      },
    })
  } else {
    const doc = await prisma.document.create({
      data: {
        title: `Minutes — ${meeting.title}`,
        fileUrl,
        category: 'Minutes',
        uploadedBy: actor.id,
      },
    })
    documentId = doc.id
  }

  await updateMeeting(meetingId, {
    status: 'FINAL',
    publishedDocumentId: documentId,
  })

  await writeAudit({
    userId: actor.id,
    action: 'MEETING_PUBLISH',
    entity: 'Meeting',
    entityId: meetingId,
    meta: { documentId, storagePath, filename },
  })

  revalidateMeetings()
  revalidatePath(`/dashboard/secretary/meetings/${meetingId}`)
  return { documentId, fileUrl }
}
