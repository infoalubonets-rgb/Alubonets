'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin, syncUserMetadata } from '@/lib/auth/session'
import { sendMemberApprovedEmail } from '@/lib/email/resend'
import type { FamilyRelationship, Role } from '@prisma/client'
import { ALL_ROLES } from '@/lib/auth/types'
import { writeAudit } from '@/lib/audit'
import { nextMembershipNumber } from '@/lib/membership'
import { createServerClient } from '@/lib/supabase-server'
import { branchHistoryData, validateFamilyAttachment, validateFamilyTransfer } from '@/lib/family-rules'
import { getDisabledRoles, isRoleActive } from '@/lib/disabled-roles'
import { sanitizePublicProfileFields } from '@/lib/public-profile'
import { isExecutive } from '@/lib/directory'
import { canRemoveSuperAdmin, grantMap } from '@/lib/super-admin'

const approveSchema = z.object({
  userId: z.string().min(1),
  approve: z.boolean(),
  note: z.string().trim().min(3).max(1000),
  identityVerified: z.boolean(),
  principalMemberId: z.string().min(1).optional(),
  familyRelationship: z.enum(['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER']).optional(),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER', 'AUDITOR']).default('MEMBER'),
})

export async function createBranchLineage(name: string) {
  const actor = await requireAdmin()
  const clean = z.string().trim().min(2).max(80).parse(name)
  const current = await prisma.appSetting.findUnique({ where: { key: 'branch_lineages' } })
  const list: string[] = current ? JSON.parse(current.value) : []
  const next = Array.from(new Set(['Default', 'Unassigned', ...list, clean])).sort((a, b) => {
    if (a === 'Default') return -1
    if (b === 'Default') return 1
    if (a === 'Unassigned') return -1
    if (b === 'Unassigned') return 1
    return a.localeCompare(b)
  })
  await prisma.appSetting.upsert({ where: { key: 'branch_lineages' }, create: { key: 'branch_lineages', value: JSON.stringify(next), updatedBy: actor.id }, update: { value: JSON.stringify(next), updatedBy: actor.id } })
  revalidatePath('/directory')
}

export async function assignMemberBranch(userId: string, branch: string) {
  const actor = await requireAdmin()
  const clean = z.string().trim().min(1).max(80).parse(branch)
  await prisma.memberProfile.upsert({ where: { userId }, create: { userId, familyBranch: clean }, update: { familyBranch: clean } })
  await writeAudit({ userId: actor.id, action: 'MEMBER_LINEAGE_ASSIGN', entity: 'User', entityId: userId, meta: { lineage: clean } })
  revalidatePath('/directory')
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER', 'AUDITOR']),
})

const accessSchema = z.object({
  userId: z.string().min(1),
  dashboardAccess: z.array(
    z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER', 'AUDITOR'])
  ),
})

const statusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'DECEASED', 'RESIGNED', 'DISQUALIFIED']),
})

const superSchema = z.object({
  userId: z.string().min(1),
  isSuperAdmin: z.boolean(),
})

function revalidateAdmin() {
  revalidatePath('/about')
  revalidatePath('/admin/members/about')
  revalidatePath('/admin')
  revalidatePath('/directory')
  revalidatePath('/admin/approvals')
  revalidatePath('/admin/roles')
  revalidatePath('/admin/gallery-queue')
  revalidatePath('/admin/audit-logs')
}

export async function setMemberApproval(input: z.input<typeof approveSchema>) {
  const actor = await requireAdmin()
  const { userId, approve, note, identityVerified, principalMemberId, familyRelationship, role } = approveSchema.parse(input)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.rejectedAt) throw new Error('This application was permanently rejected and cannot be reopened.')
  if (approve && !identityVerified) throw new Error('Confirm identity verification before approval.')
  if (approve && user.isSuperAdmin) throw new Error('Super Admin accounts cannot be approved here.')
  if (approve && role === 'ADMIN' && !actor.isSuperAdmin) throw new Error('Only a Super Admin can assign the Admin role')
  if (approve && !(await isRoleActive(role as Role))) throw new Error('That role is currently deactivated.')

  let selectedPrincipal = null
  if (approve && !user.principalMemberId && !user.isPrincipal) {
    if (!principalMemberId || !familyRelationship) {
      throw new Error('Link this applicant to a Principal Member before approval.')
    }
    selectedPrincipal = await prisma.user.findUnique({ where: { id: principalMemberId } })
    if (!selectedPrincipal) throw new Error('Principal Member not found')
    validateFamilyAttachment(user, selectedPrincipal)
  }

  if (!approve) {
    // Soft retention: keep the applicant row (and any family/history links) with
    // INACTIVE + rejectedAt so finance/audit references are never hard-deleted.
    const authUserId = user.authUserId
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'INACTIVE',
        rejectionReason: note || 'Application rejected',
        rejectedAt: new Date(),
        approvalNotes: null,
        approvedAt: null,
        identityVerificationStatus: 'REJECTED',
        authUserId: null,
      },
    })
    after(async () => {
      await writeAudit({
        userId: actor.id,
        action: 'MEMBER_REJECT',
        entity: 'User',
        entityId: userId,
        reason: note,
        oldValue: { status: user.status, email: user.email },
        newValue: { status: 'INACTIVE', rejectedAt: updated.rejectedAt },
        meta: { rejectedApplicant: user.fullName, rejectedEmail: user.email, retained: true },
      })
      if (authUserId) {
        const { error } = await createServerClient().auth.admin.deleteUser(authUserId)
        if (error) console.error('Could not delete rejected Supabase user', error)
      }
    })
    revalidateAdmin()
    return updated
  }

  const status = 'ACTIVE'
  const updated = await prisma.$transaction(async (tx) => {
    const membershipNumber =
      approve && !user.membershipNumber ? await nextMembershipNumber(tx) : user.membershipNumber
    return tx.user.update({
      where: { id: userId },
      data: {
        status,
        role: role as Role,
        membershipNumber,
        approvalNotes: approve ? note : null,
        rejectionReason: approve ? null : note,
        approvedAt: approve ? new Date() : null,
        rejectedAt: approve ? null : new Date(),
        identityVerificationStatus: identityVerified ? 'VERIFIED' : approve ? 'VERIFIED' : 'REJECTED',
        principalMemberId: selectedPrincipal?.id ?? user.principalMemberId,
        familyRelationship: selectedPrincipal ? familyRelationship : user.familyRelationship,
        familyRegistrationState: selectedPrincipal || user.principalMemberId
          ? 'ACTIVE_ATTACHED'
          : user.familyRegistrationState,
      },
    })
    .then(async (approvedUser) => {
      if (selectedPrincipal && familyRelationship) {
        await tx.familyBranchHistory.create({ data: branchHistoryData({
          memberId: user.id,
          toPrincipalId: selectedPrincipal.id,
          relationship: familyRelationship as FamilyRelationship,
          approvedById: actor.id,
          reason: 'Linked to Principal Member during account approval',
        }) })
      }
      return approvedUser
    })
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: approve ? 'MEMBER_APPROVE' : 'MEMBER_REJECT',
    entity: 'User',
    entityId: userId,
    reason: note || (approve ? 'Member approved' : 'Member rejected'),
    oldValue: { status: user.status, role: user.role },
    newValue: {
      status,
      role: updated.role,
      membershipNumber: updated.membershipNumber,
      identityVerificationStatus: updated.identityVerificationStatus,
      principalMemberId: updated.principalMemberId,
    },
    meta: {
      oldStatus: user.status,
      newStatus: status,
      note,
      membershipNumber: updated.membershipNumber,
      identityVerificationStatus: updated.identityVerificationStatus,
    },
  })

  if (approve) {
    const { attachOpenCampaignsToMember } = await import('@/lib/campaigns')
    await attachOpenCampaignsToMember(updated.id).catch((error) => {
      console.error('Could not attach open campaigns to new member', error)
    })
    await sendMemberApprovedEmail(updated)
  }

  revalidateAdmin()
  return updated
}

export async function setMemberRole(input: z.infer<typeof roleSchema>) {
  const actor = await requireAdmin()
  const { userId, role } = roleSchema.parse(input)

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  if (target.isSuperAdmin) {
    throw new Error('Super Admin accounts cannot be changed by other members')
  }

  if (role === 'ADMIN' && !actor.isSuperAdmin) {
    throw new Error('Only a Super Admin can assign the Admin role')
  }
  if (target.role === 'ADMIN' && !actor.isSuperAdmin) {
    throw new Error('Only a Super Admin can change an Admin’s role')
  }
  if (!(await isRoleActive(role as Role))) {
    throw new Error('That role is currently deactivated.')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: role as Role },
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_ROLE_CHANGE',
    entity: 'User',
    entityId: userId,
    reason: `Role changed from ${target.role} to ${role}`,
    oldValue: { role: target.role },
    newValue: { role },
    meta: { oldRole: target.role, newRole: role },
  })

  revalidateAdmin()
  return updated
}

export async function setMemberDashboardAccess(input: z.infer<typeof accessSchema>) {
  const actor = await requireAdmin()
  const { userId, dashboardAccess } = accessSchema.parse(input)

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')
  if (target.isSuperAdmin) {
    throw new Error('Super Admin already has access to every workspace')
  }
  if (!actor.isSuperAdmin) {
    if (target.role === 'ADMIN') throw new Error('Only a Super Admin can change an Admin’s access')
    const hadAdmin = target.dashboardAccess.includes('ADMIN')
    const wantsAdmin = dashboardAccess.includes('ADMIN')
    if (hadAdmin !== wantsAdmin) throw new Error('Only a Super Admin can grant or remove Admin access')
  }

  const disabled = await getDisabledRoles()
  const allowedAccess = dashboardAccess.filter((role) => role === 'ADMIN' || !disabled.includes(role as Role))

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { dashboardAccess: allowedAccess as Role[] },
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_DASHBOARD_ACCESS',
    entity: 'User',
    entityId: userId,
    meta: { oldDashboardAccess: target.dashboardAccess, newDashboardAccess: dashboardAccess },
  })

  revalidateAdmin()
  return updated
}

export async function setMemberStatus(input: z.infer<typeof statusSchema>) {
  const actor = await requireAdmin()
  const { userId, status } = statusSchema.parse(input)

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  if (target.isSuperAdmin) {
    throw new Error('Cannot suspend or deactivate a Super Admin')
  }

  if (target.role === 'ADMIN' && !actor.isSuperAdmin) {
    throw new Error('Only a Super Admin can suspend Admin accounts')
  }

  if (target.id === actor.id && status !== 'ACTIVE') {
    throw new Error('You cannot suspend your own account')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: status === 'SUSPENDED' ? 'MEMBER_SUSPEND' : 'MEMBER_STATUS_CHANGE',
    entity: 'User',
    entityId: userId,
    reason: `Member status changed to ${status}`,
    oldValue: { status: target.status },
    newValue: { status },
    meta: { oldStatus: target.status, newStatus: status },
  })

  revalidateAdmin()
  return updated
}

/**
 * Admin: permanently deletes a member and their personal records (profile, payments, family
 * history, messages, sign-in data). Audit entries stay but lose the link to the member. Members
 * with attached family members, or who recorded or approved ledger entries, cannot be deleted
 * because those records are locked; give them a status such as Resigned instead.
 */
export async function deleteMember(input: { userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireAdmin()
    const userId = z.string().min(1).parse(input.userId)
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, email: true, role: true, status: true, isSuperAdmin: true, authUserId: true, membershipNumber: true,
        _count: { select: { attachedMembers: true, createdFinancialTransactions: true, approvedFinancialTransactions: true } },
      },
    })
    if (!target) return { ok: false, error: 'This member no longer exists.' }
    if (target.id === actor.id) return { ok: false, error: 'You cannot delete your own account.' }
    if (target.isSuperAdmin) return { ok: false, error: 'A Super Admin cannot be deleted. Remove their Super Admin rights first.' }
    if (target.role === 'ADMIN' && !actor.isSuperAdmin) return { ok: false, error: 'Only a Super Admin can delete an Admin.' }
    if (target._count.attachedMembers > 0) {
      return { ok: false, error: `${target.fullName} has ${target._count.attachedMembers} attached member(s). Move them to another Principal first.` }
    }
    if (target._count.createdFinancialTransactions + target._count.approvedFinancialTransactions > 0) {
      return { ok: false, error: `${target.fullName} is linked to ledger entries (for example M-Pesa payments or approvals), which can never be deleted. Set their status to Resigned or Inactive instead.` }
    }

    await prisma.$transaction(async (tx) => {
      // Children that block the delete (ON DELETE RESTRICT) but belong only to this member.
      await tx.supportingDocument.deleteMany({ where: { OR: [{ uploadedById: userId }, { contribution: { userId } }] } })
      await tx.supportMessage.deleteMany({ where: { senderId: userId } })
      await tx.familyAccountTransition.deleteMany({ where: { memberId: userId } })
      await tx.familyBranchHistory.deleteMany({ where: { memberId: userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    await writeAudit({
      userId: actor.id,
      action: 'MEMBER_DELETE',
      entity: 'User',
      entityId: userId,
      reason: `Member ${target.fullName} permanently deleted`,
      oldValue: { fullName: target.fullName, email: target.email, membershipNumber: target.membershipNumber, status: target.status, role: target.role },
      meta: { deletedMember: target.fullName, deletedEmail: target.email },
    })
    if (target.authUserId) {
      const { error } = await createServerClient().auth.admin.deleteUser(target.authUserId)
      if (error) console.error('Could not delete Supabase user of deleted member', error)
    }
    revalidateAdmin()
    revalidatePath('/contributions')
    return { ok: true }
  } catch (error) {
    // A record the system must keep (meeting minutes, documents, ledger rows…) still points at the member.
    const code = (error as { code?: string })?.code
    const message = error instanceof Error ? error.message : ''
    if (code === 'P2003' || code === 'P2014' || /foreign key|immutable|cannot be deleted|append-only/i.test(message)) {
      return { ok: false, error: 'This member is linked to records that must be kept (such as meetings, documents or finance records), so they cannot be deleted. Set their status to Resigned or Inactive instead.' }
    }
    return { ok: false, error: message || 'Could not delete the member.' }
  }
}

const standingSchema = z.object({
  userId: z.string().min(1),
  mode: z.enum(['AUTO', 'PAID_UP', 'LAPSED']),
  until: z.string().optional(),
})

/** Admin override of paid-up standing; AUTO hands the member back to the payment rules. */
export async function setMemberStanding(input: z.infer<typeof standingSchema>) {
  const actor = await requireAdmin()
  const { userId, mode, until } = standingSchema.parse(input)
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')
  const untilDate = until ? new Date(`${until}T23:59:59`) : null
  if (untilDate && (Number.isNaN(untilDate.getTime()) || untilDate < new Date())) {
    throw new Error('The end date must be today or later.')
  }

  await prisma.user.update({
    where: { id: userId },
    data: mode === 'AUTO'
      ? { standingOverride: null, standingOverrideUntil: null }
      : { standingOverride: mode, standingOverrideUntil: untilDate },
  })
  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_STANDING_OVERRIDE',
    entity: 'User',
    entityId: userId,
    reason: mode === 'AUTO' ? 'Returned to automatic standing' : `Set to ${mode}${untilDate ? ` until ${until}` : ''}`,
    oldValue: { standing: target.standing, override: target.standingOverride, until: target.standingOverrideUntil },
    newValue: { override: mode === 'AUTO' ? null : mode, until: untilDate },
  })
  const { recomputeMemberStanding } = await import('@/lib/membership-standing-sync')
  await recomputeMemberStanding(userId, actor.id)
  revalidateAdmin()
}

const contributionRightsSchema = z.object({
  userId: z.string().min(1),
  canContribute: z.boolean(),
})

/** Removing contribution rights makes the member a dependent who follows their Principal's standing. */
const aboutProfileSchema = z.object({
  userId: z.string().min(1),
  showOnAbout: z.boolean(),
  aboutTitle: z.string().trim().max(80).optional(),
  aboutOrder: z.number().int().min(0).max(999).default(0),
  fields: z.array(z.string()).max(20).default([]),
  biography: z.string().trim().max(5000).optional(),
  responsibilities: z.string().trim().max(5000).optional(),
})

/** Admin decides whether an executive appears on the public About page, and which details show. */
export async function setAboutProfile(input: z.input<typeof aboutProfileSchema>) {
  const actor = await requireAdmin()
  const data = aboutProfileSchema.parse(input)
  const target = await prisma.user.findUnique({ where: { id: data.userId } })
  if (!target) throw new Error('Member not found')
  if (data.showOnAbout && !isExecutive(target)) {
    throw new Error('Only executives can appear on the About page. Give them the Executive role (main or second role) on the Roles page first.')
  }
  const fields = sanitizePublicProfileFields(data.fields)
  if ((data.biography !== undefined || data.responsibilities !== undefined) && !isExecutive(target)) throw new Error('Only Executive accounts can have an About Us profile.')
  const previousProfile = await prisma.committeeProfile.findFirst({ where: { userId: target.id }, orderBy: { updatedAt: 'desc' } })
  const updated = await prisma.$transaction(async tx => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: { showOnAbout: data.showOnAbout, aboutTitle: data.aboutTitle || null, aboutOrder: data.aboutOrder, publicProfileFields: fields },
    })
    if (data.biography !== undefined || data.responsibilities !== undefined) {
      const profileData = { name: target.fullName, position: data.aboutTitle || 'Executive Committee', biography: data.biography ?? previousProfile?.biography ?? '', responsibilities: data.responsibilities ?? previousProfile?.responsibilities ?? '', displayOrder: data.aboutOrder, status: data.showOnAbout ? 'PUBLISHED' as const : 'DRAFT' as const, editedById: actor.id }
      if (previousProfile) await tx.committeeProfile.update({ where: { id: previousProfile.id }, data: profileData })
      else await tx.committeeProfile.create({ data: { ...profileData, userId: target.id } })
    }
    return user
  })
  await writeAudit({
    userId: actor.id,
    action: 'ABOUT_PROFILE_UPDATE',
    entity: 'User',
    entityId: target.id,
    oldValue: { showOnAbout: target.showOnAbout, aboutTitle: target.aboutTitle, aboutOrder: target.aboutOrder, fields: target.publicProfileFields, biography: previousProfile?.biography ?? '', responsibilities: previousProfile?.responsibilities ?? '' },
    newValue: { showOnAbout: updated.showOnAbout, aboutTitle: updated.aboutTitle, aboutOrder: updated.aboutOrder, fields, biography: data.biography ?? previousProfile?.biography ?? '', responsibilities: data.responsibilities ?? previousProfile?.responsibilities ?? '' },
  })
  revalidatePath('/about')
  revalidatePath('/directory')
  revalidatePath('/admin/members/about')
}

/** Saves the About page selection for many executives at once (Members → Executives). */
export async function setAboutProfiles(input: z.input<typeof aboutProfileSchema>[]) {
  const actor = await requireAdmin()
  const entries = z.array(aboutProfileSchema).max(200).parse(input)
  const targets = await prisma.user.findMany({ where: { id: { in: entries.map((entry) => entry.userId) } } })
  const byId = new Map(targets.map((target) => [target.id, target]))

  let changed = 0
  for (const entry of entries) {
    const target = byId.get(entry.userId)
    if (!target) throw new Error('Member not found')
    if (entry.showOnAbout && !isExecutive(target)) {
      throw new Error(`${target.fullName} is no longer an executive, so they cannot appear on the About page.`)
    }
    const fields = sanitizePublicProfileFields(entry.fields)
    const title = entry.aboutTitle || null
    const same =
      target.showOnAbout === entry.showOnAbout &&
      target.aboutTitle === title &&
      target.aboutOrder === entry.aboutOrder &&
      target.publicProfileFields.length === fields.length &&
      fields.every((field) => target.publicProfileFields.includes(field))
    if (same) continue

    await prisma.user.update({
      where: { id: target.id },
      data: { showOnAbout: entry.showOnAbout, aboutTitle: title, aboutOrder: entry.aboutOrder, publicProfileFields: fields },
    })
    await writeAudit({
      userId: actor.id,
      action: 'ABOUT_PROFILE_UPDATE',
      entity: 'User',
      entityId: target.id,
      oldValue: { showOnAbout: target.showOnAbout, aboutTitle: target.aboutTitle, aboutOrder: target.aboutOrder, fields: target.publicProfileFields },
      newValue: { showOnAbout: entry.showOnAbout, aboutTitle: title, aboutOrder: entry.aboutOrder, fields },
    })
    changed += 1
  }

  revalidatePath('/about')
  revalidatePath('/directory')
  return { changed }
}

export async function setContributionRights(input: z.infer<typeof contributionRightsSchema>) {
  const actor = await requireAdmin()
  const { userId, canContribute } = contributionRightsSchema.parse(input)
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  await prisma.user.update({ where: { id: userId }, data: { contributionExempt: !canContribute } })
  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_CONTRIBUTION_RIGHTS',
    entity: 'User',
    entityId: userId,
    reason: canContribute ? 'Contribution rights restored' : 'Contribution rights removed',
    oldValue: { contributionExempt: target.contributionExempt },
    newValue: { contributionExempt: !canContribute },
  })
  const { recomputeMemberStanding } = await import('@/lib/membership-standing-sync')
  await recomputeMemberStanding(userId, actor.id)
  revalidateAdmin()
}

export async function setSuperAdminFlag(input: z.infer<typeof superSchema>) {
  const actor = await requireAdmin()
  if (!actor.isSuperAdmin) {
    throw new Error('Only a Super Admin can change Super Admin flags')
  }

  const { userId, isSuperAdmin } = superSchema.parse(input)
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  if (target.isSuperAdmin === isSuperAdmin) {
    return target
  }

  if (!isSuperAdmin) {
    if (target.id === actor.id) throw new Error('You cannot remove your own Super Admin access')
    const grants = await prisma.user.findMany({
      where: { OR: [{ isSuperAdmin: true }, { superAdminGrantedById: { not: null } }] },
      select: { id: true, superAdminGrantedById: true },
    })
    if (!canRemoveSuperAdmin(actor.id, target.id, grantMap(grants))) {
      throw new Error('Only the Super Admin who granted this access (or someone above them) can remove it')
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isSuperAdmin: false, role: 'ADMIN', dashboardAccess: [] },
    })
    await syncUserMetadata(updated)
    await writeAudit({
      userId: actor.id,
      action: 'SUPER_ADMIN_FLAG',
      entity: 'User',
      entityId: userId,
      reason: 'Super Admin removed — account stays an Admin',
      meta: { isSuperAdmin: false },
    })
    revalidateAdmin()
    return updated
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isSuperAdmin: true,
      superAdminGrantedById: actor.id,
      role: 'ADMIN',
      dashboardAccess: ALL_ROLES as Role[],
    },
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: 'SUPER_ADMIN_FLAG',
    entity: 'User',
    entityId: userId,
    meta: { isSuperAdmin: true },
  })

  revalidateAdmin()
  return updated
}

const principalSchema = z.object({
  userId: z.string().min(1),
  isPrincipal: z.boolean(),
  reason: z.string().trim().max(1000).optional(),
})

export async function setPrincipalStatus(input: z.infer<typeof principalSchema>) {
  const actor = await requireAdmin()
  const { userId, isPrincipal, reason } = principalSchema.parse(input)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { attachedMembers: { select: { id: true, fullName: true } } },
  })
  if (!target) throw new Error('User not found')

  if (target.status !== 'ACTIVE' && isPrincipal) {
    throw new Error('Only ACTIVE members can be assigned as Principal')
  }

  // Demoting a Principal leaves everyone attached to them with no Principal.
  const detached = isPrincipal ? [] : target.attachedMembers
  const updated = await prisma.$transaction(async (tx) => {
    if (detached.length) {
      await tx.user.updateMany({
        where: { principalMemberId: userId, familyRegistrationState: 'ACTIVE_ATTACHED' },
        data: { principalMemberId: null, familyRelationship: null, familyRegistrationState: 'STANDARD' },
      })
      await tx.user.updateMany({
        where: { principalMemberId: userId },
        data: { principalMemberId: null, familyRelationship: null },
      })
    }
    return tx.user.update({
      where: { id: userId },
      data: {
        isPrincipal,
        principalMemberId: isPrincipal ? null : target.principalMemberId,
        familyRelationship: isPrincipal ? null : target.familyRelationship,
        familyRegistrationState: isPrincipal
          ? 'STANDARD'
          : target.familyRegistrationState === 'ACTIVE_ATTACHED'
            ? 'STANDARD'
            : target.familyRegistrationState,
      },
    })
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: isPrincipal ? 'PRINCIPAL_ASSIGN' : 'PRINCIPAL_REVOKE',
    entity: 'User',
    entityId: userId,
    reason: reason || (isPrincipal ? 'Assigned as Principal Member' : 'Removed Principal status'),
    oldValue: { isPrincipal: target.isPrincipal, principalMemberId: target.principalMemberId },
    newValue: { isPrincipal, detachedMembers: detached.map((m) => m.fullName) },
    meta: { targetEmail: target.email, targetName: target.fullName },
  })

  if (detached.length) {
    const { recomputeStandingSafely } = await import('@/lib/finance')
    const rows = await prisma.user.findMany({ where: { id: { in: detached.map((m) => m.id) } } })
    for (const row of rows) {
      await syncUserMetadata(row)
      await writeAudit({
        userId: actor.id,
        action: 'FAMILY_BRANCH_REMOVE',
        entity: 'User',
        entityId: row.id,
        reason: `${target.fullName} is no longer a Principal`,
        oldValue: { principalMemberId: userId },
        newValue: { principalMemberId: null },
        meta: { memberName: row.fullName, formerPrincipalName: target.fullName },
      })
      await recomputeStandingSafely(row.id, actor.id)
    }
  }

  revalidateAdmin()
  revalidatePath('/admin/family')
  revalidatePath('/dashboard/member/family')
  return { id: updated.id, isPrincipal: updated.isPrincipal, detachedCount: detached.length }
}

const transferFamilyMemberSchema = z.object({
  memberId: z.string().min(1),
  newPrincipalId: z.string().min(1),
  relationship: z.enum(['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER']),
  reason: z.string().trim().min(5).max(1000),
})

export async function transferFamilyMember(input: z.infer<typeof transferFamilyMemberSchema>) {
  const actor = await requireAdmin()
  const data = transferFamilyMemberSchema.parse(input)
  return moveFamilyMember({ ...data, actorId: actor.id })
}

const transferMyAttachedMemberSchema = z.object({
  memberId: z.string().min(1),
  newPrincipalId: z.string().min(1),
  reason: z.string().trim().min(5, 'Give a short reason (at least 5 characters).').max(1000),
})

/** A Principal hands one of their own attached members over to another Principal. */
export async function transferMyAttachedMember(input: z.infer<typeof transferMyAttachedMemberSchema>) {
  const actor = await requireActiveRole()
  const data = transferMyAttachedMemberSchema.parse(input)
  if (!actor.isPrincipal) throw new Error('Only a Principal Member can transfer attached members.')
  // Moving members between branches is for Admins only (Members page → Assign members).
  if (actor.role !== 'ADMIN' && !actor.isSuperAdmin) throw new Error('Only an administrator can move family members between branches.')
  const member = await prisma.user.findUnique({ where: { id: data.memberId }, select: { principalMemberId: true, familyRelationship: true } })
  if (!member || member.principalMemberId !== actor.id) throw new Error('You can only transfer members attached to your own branch.')
  if (data.newPrincipalId === actor.id) throw new Error('Choose a different Principal.')
  const relationship = (['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER'] as const).includes(member.familyRelationship as 'SPOUSE')
    ? (member.familyRelationship as 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER')
    : 'OTHER'
  const moved = await moveFamilyMember({ ...data, relationship, actorId: actor.id })
  const { recomputeStandingSafely } = await import('@/lib/finance')
  await recomputeStandingSafely(moved.id, actor.id)
  return { id: moved.id }
}

async function moveFamilyMember(data: {
  memberId: string
  newPrincipalId: string
  relationship: 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER'
  reason: string
  actorId: string
}) {
  const actor = { id: data.actorId }
  const [member, nextPrincipal] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.memberId } }),
    prisma.user.findUnique({ where: { id: data.newPrincipalId } }),
  ])
  if (!member) throw new Error('Family member not found')
  if (!nextPrincipal) throw new Error('New Principal Member not found')
  if (!member.principalMemberId) throw new Error('This member is not currently attached to a branch')

  const previousPrincipalId = member.principalMemberId
  validateFamilyTransfer(member, previousPrincipalId, nextPrincipal)

  const updated = await prisma.$transaction(async (tx) => {
    const moved = await tx.user.update({
      where: { id: member.id },
      data: {
        principalMemberId: nextPrincipal.id,
        familyRelationship: data.relationship as FamilyRelationship,
        familyRegistrationState:
          member.familyRegistrationState === 'STANDARD'
            ? member.status === 'ACTIVE' ? 'ACTIVE_ATTACHED' : 'INVITED'
            : member.familyRegistrationState,
      },
    })
    await tx.familyBranchHistory.create({
      data: branchHistoryData({
        memberId: member.id,
        fromPrincipalId: previousPrincipalId,
        toPrincipalId: nextPrincipal.id,
        relationship: data.relationship as FamilyRelationship,
        approvedById: actor.id,
        reason: data.reason,
      }),
    })
    return moved
  })

  await writeAudit({
    userId: actor.id,
    action: 'FAMILY_BRANCH_TRANSFER',
    entity: 'User',
    entityId: member.id,
    reason: data.reason,
    oldValue: { principalMemberId: previousPrincipalId, familyRelationship: member.familyRelationship },
    newValue: { principalMemberId: nextPrincipal.id, familyRelationship: data.relationship },
    meta: { memberName: member.fullName, newPrincipalName: nextPrincipal.fullName },
  })

  await syncUserMetadata(updated)
  revalidateAdmin()
  revalidatePath('/admin/family')
  revalidatePath('/dashboard/member/family')
  return updated
}

const assignFamilyMemberSchema = z.object({
  memberId: z.string().min(1),
  principalId: z.string().min(1),
  relationship: z.enum(['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER']),
  reason: z.string().trim().min(5).max(1000),
})

export async function assignFamilyMember(input: z.infer<typeof assignFamilyMemberSchema>) {
  const actor = await requireAdmin()
  const data = assignFamilyMemberSchema.parse(input)
  return attachFamilyMember({ ...data, actorId: actor.id })
}

const linkFamilyMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1, 'Select at least one member.').max(200),
  principalId: z.string().min(1),
  relationship: z.enum(['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER']),
  reason: z.string().trim().min(5).max(1000),
})

/** Links one or many members to a Principal — unassigned members are attached, others are transferred. */
export async function linkFamilyMembers(input: z.infer<typeof linkFamilyMembersSchema>) {
  const actor = await requireAdmin()
  const data = linkFamilyMembersSchema.parse(input)
  const members = await prisma.user.findMany({
    where: { id: { in: [...new Set(data.memberIds)] } },
    select: { id: true, fullName: true, principalMemberId: true },
  })
  let linked = 0
  const failed: { name: string; message: string }[] = []
  for (const member of members) {
    if (member.principalMemberId === data.principalId) continue
    try {
      if (member.principalMemberId) {
        await moveFamilyMember({ memberId: member.id, newPrincipalId: data.principalId, relationship: data.relationship, reason: data.reason, actorId: actor.id })
      } else {
        await attachFamilyMember({ memberId: member.id, principalId: data.principalId, relationship: data.relationship, reason: data.reason, actorId: actor.id })
      }
      linked++
    } catch (e) {
      failed.push({ name: member.fullName, message: e instanceof Error ? e.message : 'Could not link' })
    }
  }
  return { linked, failed }
}

async function attachFamilyMember(data: z.infer<typeof assignFamilyMemberSchema> & { actorId: string }) {
  const actor = { id: data.actorId }
  const [member, principal] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.memberId } }),
    prisma.user.findUnique({ where: { id: data.principalId } }),
  ])
  if (!member) throw new Error('Member not found')
  if (!principal) throw new Error('Principal Member not found')
  if (member.principalMemberId) throw new Error('This member is already assigned; use transfer instead')
  validateFamilyAttachment(member, principal)

  const updated = await prisma.$transaction(async (tx) => {
    const attached = await tx.user.update({ where: { id: member.id }, data: {
      principalMemberId: principal.id,
      familyRelationship: data.relationship as FamilyRelationship,
      familyRegistrationState: member.status === 'ACTIVE' ? 'ACTIVE_ATTACHED' : 'INVITED',
    } })
    await tx.familyBranchHistory.create({ data: branchHistoryData({
      memberId: member.id, toPrincipalId: principal.id,
      relationship: data.relationship as FamilyRelationship,
      approvedById: actor.id, reason: data.reason,
    }) })
    return attached
  })
  await writeAudit({ userId: actor.id, action: 'FAMILY_BRANCH_ASSIGN', entity: 'User', entityId: member.id,
    reason: data.reason, oldValue: { principalMemberId: null },
    newValue: { principalMemberId: principal.id, familyRelationship: data.relationship },
    meta: { memberName: member.fullName, principalName: principal.fullName } })
  await syncUserMetadata(updated)
  revalidateAdmin()
  revalidatePath('/admin/family')
  revalidatePath('/dashboard/member/family')
  return updated
}
