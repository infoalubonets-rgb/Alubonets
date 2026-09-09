'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { ageOn } from '@/lib/profile-privacy'

const DIRECTORY_SAFE_FIELDS = ['fullName', 'role', 'familyBranch', 'profession', 'skills', 'location'] as const

const visibilitySchema = z.object({
  userId: z.string().min(1),
  visibleToMembers: z.boolean(),
  allowedFields: z.array(z.enum(DIRECTORY_SAFE_FIELDS)).default(['fullName', 'role', 'familyBranch']),
  reviewAt: z.string().optional().nullable(),
})

export type DirectorySafeField = (typeof DIRECTORY_SAFE_FIELDS)[number]

export { DIRECTORY_SAFE_FIELDS }

function isChildDependent(relationship: string | null | undefined, dob: Date | null | undefined) {
  if (relationship === 'SON' || relationship === 'DAUGHTER' || relationship === 'CHILD' || relationship === 'DEPENDENT') {
    if (dob) return ageOn(dob) < 18
    return true
  }
  return false
}

/**
 * Roles allowed to see every active member regardless of individual visibility settings.
 * Admin and Super Admin always qualify; extra roles are opt-in from Admin → Settings.
 */
export const DIRECTORY_FULL_ACCESS_SETTING = 'directory_full_access_roles'

async function rolesWithFullDirectoryAccess(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: DIRECTORY_FULL_ACCESS_SETTING } })
  return (row?.value || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
}

export type DirectoryMember = {
  id: string
  fullName: string
  relationship: string | null
  principalName: string | null
  isPrincipal: boolean
  role: string | null
  familyBranch: string | null
  profession: string | null
  skills: string | null
  location: string | null
}

export async function getDirectoryMembers(): Promise<DirectoryMember[]> {
  // Viewer identity comes from the session — never from a caller-supplied id.
  const viewer = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  const fullAccessRoles = await rolesWithFullDirectoryAccess()
  const seesEveryone =
    viewer.role === 'ADMIN' || viewer.isSuperAdmin || fullAccessRoles.includes(viewer.role)

  const rows = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      location: true,
      role: true,
      isPrincipal: true,
      principalMemberId: true,
      familyRelationship: true,
      memberProfile: { select: { familyBranch: true, profession: true, skills: true, dateOfBirth: true } },
      profileVisibility: true,
      principal: { select: { id: true, fullName: true } },
    },
  })

  const now = new Date()

  return rows.flatMap((row): DirectoryMember[] => {
    const child = isChildDependent(row.familyRelationship, row.memberProfile?.dateOfBirth)
    const visibility = row.profileVisibility
    // Consent lapses once its review date passes — an expired opt-in stops publishing.
    const consentExpired = visibility?.reviewAt ? visibility.reviewAt <= now : false
    const optedIn = Boolean(visibility?.visibleToMembers) && !consentExpired

    const visible = seesEveryone
      ? true
      : child
        // Children/dependants never appear for ordinary viewers, whatever the flag says.
        ? false
        : row.isPrincipal || optedIn

    // Hidden members are omitted entirely — no name, relationship or branch summary leaks.
    if (!visible && row.id !== viewer.id) return []

    const configured = Array.isArray(visibility?.allowedFields)
      ? (visibility!.allowedFields as string[])
      : ['fullName', 'role', 'familyBranch']
    // Staff with full access see every safe field; everyone else sees only what was approved.
    const allowed = new Set(seesEveryone ? [...DIRECTORY_SAFE_FIELDS] : configured)

    return [{
      id: row.id,
      fullName: allowed.has('fullName') ? row.fullName : 'Member',
      relationship: row.familyRelationship,
      principalName: row.principal?.fullName || null,
      isPrincipal: row.isPrincipal,
      role: allowed.has('role') ? row.role : null,
      familyBranch: allowed.has('familyBranch') ? row.memberProfile?.familyBranch || null : null,
      profession: allowed.has('profession') ? row.memberProfile?.profession || null : null,
      skills: allowed.has('skills') ? row.memberProfile?.skills || null : null,
      location: allowed.has('location') ? row.location || null : null,
    }]
  })
}

export async function setProfileVisibility(input: z.infer<typeof visibilitySchema>) {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  const data = visibilitySchema.parse(input)
  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    include: { memberProfile: { select: { dateOfBirth: true } } },
  })
  if (!target) throw new Error('Member not found')

  const isSelf = actor.id === target.id
  const isPrincipalOf =
    Boolean(target.principalMemberId) && target.principalMemberId === actor.id && actor.isPrincipal
  const isAdmin = actor.role === 'ADMIN' || actor.isSuperAdmin
  if (!isSelf && !isPrincipalOf && !isAdmin) {
    throw new Error('Only the Principal Member (or Admin) can change attached-member visibility')
  }

  const child = isChildDependent(target.familyRelationship, target.memberProfile?.dateOfBirth)
  // Children and dependants are never published to the member directory.
  if (child && data.visibleToMembers) {
    throw new Error('Child and dependant profiles stay hidden from the member directory.')
  }

  // Anyone may hide themselves, but publishing an attached profile needs Principal consent —
  // an attached adult must not be able to opt themselves in.
  if (data.visibleToMembers && !isAdmin && !isPrincipalOf) {
    const publishingOwnPrincipalProfile = isSelf && target.isPrincipal
    if (!publishingOwnPrincipalProfile) {
      throw new Error('Your Principal Member must approve before your profile appears in the directory.')
    }
  }

  const reviewAt = data.reviewAt ? new Date(data.reviewAt) : null
  const previous = await prisma.profileVisibility.findUnique({ where: { userId: data.userId } })
  const row = await prisma.profileVisibility.upsert({
    where: { userId: data.userId },
    create: {
      userId: data.userId,
      visibleToMembers: data.visibleToMembers,
      allowedFields: data.allowedFields,
      approvedByPrincipalId: isPrincipalOf || (actor.isPrincipal && isSelf) ? actor.id : null,
      changedById: actor.id,
      changedAt: new Date(),
      reviewAt,
    },
    update: {
      visibleToMembers: data.visibleToMembers,
      allowedFields: data.allowedFields,
      approvedByPrincipalId: isPrincipalOf ? actor.id : previous?.approvedByPrincipalId,
      changedById: actor.id,
      changedAt: new Date(),
      reviewAt,
    },
  })

  await writeAudit({
    userId: actor.id,
    action: 'PROFILE_VISIBILITY_CHANGE',
    entity: 'ProfileVisibility',
    entityId: row.id,
    oldValue: previous
      ? { visibleToMembers: previous.visibleToMembers, allowedFields: previous.allowedFields }
      : undefined,
    newValue: { visibleToMembers: row.visibleToMembers, allowedFields: row.allowedFields },
  })

  revalidatePath('/directory')
  revalidatePath('/dashboard/member/family')
  return row
}
