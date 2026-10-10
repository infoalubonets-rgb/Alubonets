'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null)

const committeeSchema = z.object({
  id: optionalText(64),
  userId: optionalText(64),
  name: z.string().trim().max(120).default(''),
  position: z.string().trim().min(2, 'Enter the executive title.').max(120),
  responsibilities: optionalText(2000),
  biography: z.string().trim().max(4000).default(''),
  photoUrl: optionalText(500).refine((value) => !value || /^https:\/\//.test(value), {
    message: 'Photo URL must start with https://',
  }),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
  published: z.enum(['true', 'false']).default('false'),
})

type Result = { ok: true } | { ok: false; error: string }

function refreshCommittee() {
  revalidatePath('/about')
  revalidatePath('/admin/announcements/about')
}

/** Creates or updates an About Us executive profile (Admin / Super Admin only). */
export async function saveCommitteeProfile(formData: FormData): Promise<Result> {
  try {
    const actor = await requireAdmin()
    const data = committeeSchema.parse({
      id: formData.get('id') ?? undefined,
      userId: formData.get('userId') ?? undefined,
      name: formData.get('name') ?? undefined,
      position: formData.get('position'),
      responsibilities: formData.get('responsibilities') ?? undefined,
      biography: formData.get('biography') ?? undefined,
      photoUrl: formData.get('photoUrl') ?? undefined,
      displayOrder: formData.get('displayOrder') || 0,
      published: formData.get('published') ?? undefined,
    })

    let name = data.name
    if (data.userId) {
      const member = await prisma.user.findUnique({ where: { id: data.userId }, select: { fullName: true } })
      if (!member) return { ok: false, error: 'Selected member was not found.' }
      if (!name) name = member.fullName
    }
    if (name.length < 2) return { ok: false, error: 'Choose a member or enter a name.' }

    const values = {
      userId: data.userId,
      name,
      position: data.position,
      responsibilities: data.responsibilities,
      biography: data.biography,
      photoUrl: data.photoUrl,
      displayOrder: data.displayOrder,
      status: data.published === 'true' ? ('PUBLISHED' as const) : ('DRAFT' as const),
      editedById: actor.id,
    }
    const previous = data.id ? await prisma.committeeProfile.findUnique({ where: { id: data.id } }) : null
    if (data.id && !previous) return { ok: false, error: 'This profile no longer exists.' }
    const saved = previous
      ? await prisma.committeeProfile.update({ where: { id: previous.id }, data: values })
      : await prisma.committeeProfile.create({ data: values })

    await writeAudit({
      userId: actor.id,
      action: previous ? 'COMMITTEE_PROFILE_UPDATE' : 'COMMITTEE_PROFILE_CREATE',
      entity: 'CommitteeProfile',
      entityId: saved.id,
      oldValue: previous
        ? { name: previous.name, position: previous.position, status: previous.status, userId: previous.userId, displayOrder: previous.displayOrder }
        : undefined,
      newValue: { name, position: data.position, status: values.status, userId: data.userId, displayOrder: data.displayOrder },
    })
    refreshCommittee()
    return { ok: true }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message || 'Invalid profile.' }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save profile.' }
  }
}

export async function deleteCommitteeProfile(formData: FormData): Promise<Result> {
  try {
    const actor = await requireAdmin()
    const id = z.string().min(1).parse(formData.get('id'))
    const removed = await prisma.committeeProfile.delete({ where: { id } })
    await writeAudit({
      userId: actor.id,
      action: 'COMMITTEE_PROFILE_DELETE',
      entity: 'CommitteeProfile',
      entityId: id,
      oldValue: { name: removed.name, position: removed.position, status: removed.status },
    })
    refreshCommittee()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not remove profile.' }
  }
}
