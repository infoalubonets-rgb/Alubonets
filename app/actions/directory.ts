'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { ageOn } from '@/lib/profile-privacy'
import { familyTag } from '@/lib/family-tags'
import {
  DIRECTORY_SAFE_FIELDS,
  canViewMemberDirectory,
  isExecutive,
  type DirectoryMember,
} from '@/lib/directory'
import { NOT_DELETED_MEMBER } from '@/lib/deleted-member'
import { assignMissingMembershipNumbers } from '@/lib/member-id-assign'

const visibilitySchema = z.object({
  userId: z.string().min(1),
  visibleToMembers: z.boolean(),
  allowedFields: z.array(z.enum(DIRECTORY_SAFE_FIELDS)).default(['fullName', 'role']),
  reviewAt: z.string().optional().nullable(),
})

function isChildDependent(relationship: string | null | undefined, dob: Date | null | undefined) {
  if (relationship === 'SON' || relationship === 'DAUGHTER' || relationship === 'CHILD' || relationship === 'DEPENDENT') {
    if (dob) return ageOn(dob) < 18
    return true
  }
  return false
}

export async function getDirectoryMembers(): Promise<DirectoryMember[]> {
  // Viewer identity comes from the session — never from a caller-supplied id.
  const viewer = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER', 'AUDITOR'])
  if (!canViewMemberDirectory(viewer)) {
    throw new Error('Only Admin, Super Admin, Auditor and executives can open the member list.')
  }
  const isAdmin = viewer.role === 'ADMIN' || viewer.isSuperAdmin
  // Accounts created without approval (bootstrap admins, seeded officers) get their missing member ID.
  if (isAdmin) await assignMissingMembershipNumbers()

  const rows = await prisma.user.findMany({
    // Admins manage every account here, so they also see pending, suspended and former members.
    where: isAdmin ? NOT_DELETED_MEMBER : { status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      role: true,
      status: true,
      isSuperAdmin: true,
      dashboardAccess: true,
      membershipNumber: true,
      standing: true,
      standingReason: true,
      standingOverride: true,
      standingOverrideUntil: true,
      contributionExempt: true,
      showOnAbout: true,
      aboutTitle: true,
      aboutOrder: true,
      publicProfileFields: true,
      approvedAt: true,
      createdAt: true,
      isPrincipal: true,
      principalMemberId: true,
      familyRelationship: true,
      familyCode: true,
      familyMemberNumber: true,
      memberProfile: {
        select: {
          profession: true,
          skills: true,
          dateOfBirth: true,
          gender: true,
          familyBranch: true,
          memberCategory: true,
          educationLevel: true,
          interests: true,
          mentorshipArea: true,
        },
      },
      profileVisibility: true,
      principal: { select: { id: true, fullName: true, familyCode: true } },
      _count: { select: { attachedMembers: true } },
    },
  })

  return rows.map((row): DirectoryMember => {
    const child = isChildDependent(row.familyRelationship, row.memberProfile?.dateOfBirth)
    return {
      id: row.id,
      fullName: row.fullName,
      relationship: row.familyRelationship,
      principalName: row.principal?.fullName || null,
      isPrincipal: row.isPrincipal,
      familyTag: familyTag(row),
      familyCode: row.isPrincipal ? row.familyCode : row.principal?.familyCode ?? null,
      role: row.role,
      profession: row.memberProfile?.profession || null,
      skills: row.memberProfile?.skills || null,
      location: row.location || null,
      isSuperAdmin: row.isSuperAdmin,
      isExecutive: isExecutive(row),
      isMinor: child || (row.memberProfile?.dateOfBirth ? ageOn(row.memberProfile.dateOfBirth) < 18 : false),
      details: {
            membershipNumber: row.membershipNumber,
            standing: row.standing,
            joinedAt: (row.approvedAt ?? row.createdAt).toISOString(),
            age: row.memberProfile?.dateOfBirth ? ageOn(row.memberProfile.dateOfBirth) : null,
            gender: row.memberProfile?.gender ?? null,
            familyBranch: row.memberProfile?.familyBranch ?? null,
            memberCategory: row.memberProfile?.memberCategory ?? null,
            educationLevel: row.memberProfile?.educationLevel ?? null,
            interests: row.memberProfile?.interests ?? null,
            mentorshipArea: row.memberProfile?.mentorshipArea ?? null,
            attachedCount: row._count.attachedMembers,
          },
      // Auditors see contact details read-only; account controls stay with Admins.
      contact: { email: row.email, phone: row.phone },
      account: isAdmin
        ? {
            status: row.status,
            standingReason: row.standingReason,
            standingOverride: row.standingOverride,
            standingOverrideUntil: row.standingOverrideUntil?.toISOString() ?? null,
            contributionExempt: row.contributionExempt,
            about: { show: row.showOnAbout, title: row.aboutTitle, order: row.aboutOrder, fields: row.publicProfileFields },
          }
        : null,
    }
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
