'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, syncUserMetadata } from '@/lib/auth/session'
import { sendMemberApprovedEmail } from '@/lib/email/resend'
import type { FamilyRelationship, Role } from '@prisma/client'
import { ALL_ROLES } from '@/lib/auth/types'
import { writeAudit } from '@/lib/audit'
import { nextMembershipNumber } from '@/lib/membership'
import { createServerClient } from '@/lib/supabase-server'
import { branchHistoryData, validateFamilyAttachment, validateFamilyTransfer } from '@/lib/family-rules'

const approveSchema = z.object({
  userId: z.string().min(1),
  approve: z.boolean(),
  note: z.string().trim().min(3).max(1000),
  identityVerified: z.boolean(),
  principalMemberId: z.string().min(1).optional(),
  familyRelationship: z.enum(['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER']).optional(),
})

export async function createBranchLineage(name: string) {
  const actor = await requireAdmin()
  const clean = z.string().trim().min(2).max(80).parse(name)
  const current = await prisma.appSetting.findUnique({ where: { key: 'branch_lineages' } })
  const list: string[] = current ? JSON.parse(current.value) : []
  const next = Array.from(new Set(['Default', ...list, clean])).sort((a, b) => a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b))
  await prisma.appSetting.upsert({ where: { key: 'branch_lineages' }, create: { key: 'branch_lineages', value: JSON.stringify(next), updatedBy: actor.id }, update: { value: JSON.stringify(next), updatedBy: actor.id } })
  revalidatePath('/admin/members')
}

export async function assignMemberBranch(userId: string, branch: string) {
  const actor = await requireAdmin()
  const clean = z.string().trim().min(1).max(80).parse(branch)
  await prisma.memberProfile.upsert({ where: { userId }, create: { userId, familyBranch: clean }, update: { familyBranch: clean } })
  await writeAudit({ userId: actor.id, action: 'MEMBER_BRANCH_ASSIGN', entity: 'User', entityId: userId, meta: { branch: clean } })
  revalidatePath('/admin/members')
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER']),
})

const accessSchema = z.object({
  userId: z.string().min(1),
  dashboardAccess: z.array(
    z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  ),
})

const statusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']),
})

const superSchema = z.object({
  userId: z.string().min(1),
  isSuperAdmin: z.boolean(),
})

function revalidateAdmin() {
  revalidatePath('/admin')
  revalidatePath('/admin/members')
  revalidatePath('/admin/approvals')
  revalidatePath('/admin/roles')
  revalidatePath('/admin/gallery-queue')
  revalidatePath('/admin/audit-logs')
}

export async function setMemberApproval(input: z.infer<typeof approveSchema>) {
  const actor = await requireAdmin()
  const { userId, approve, note, identityVerified, principalMemberId, familyRelationship } = approveSchema.parse(input)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.rejectedAt) throw new Error('This application was permanently rejected and cannot be reopened.')
  if (approve && !identityVerified) throw new Error('Confirm identity verification before approval.')

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
    await prisma.$transaction(async (tx) => {
      // Family history and transition records intentionally use restrictive
      // foreign keys. A pending applicant may already have these records when
      // a Principal Member invited or linked them before admin review.
      await tx.familyBranchHistory.deleteMany({ where: { memberId: userId } })
      await tx.familyAccountTransition.deleteMany({ where: { memberId: userId } })
      await tx.user.delete({ where: { id: userId } })
    })
    // The application is already gone from the primary database. Audit and
    // external Auth cleanup can finish after the response instead of keeping
    // the approvals modal blocked on network latency.
    after(async () => {
      await writeAudit({
        userId: actor.id,
        action: 'MEMBER_REJECT',
        entity: 'User',
        entityId: userId,
        reason: note,
        oldValue: { status: user.status, email: user.email },
        newValue: { deleted: true },
        meta: { rejectedApplicant: user.fullName, rejectedEmail: user.email },
      })
      if (user.authUserId) {
        const { error } = await createServerClient().auth.admin.deleteUser(user.authUserId)
        if (error) console.error('Could not delete rejected Supabase user', error)
      }
    })
    revalidateAdmin()
    return null
  }

  const status = 'ACTIVE'
  const updated = await prisma.$transaction(async (tx) => {
    const membershipNumber =
      approve && !user.membershipNumber ? await nextMembershipNumber(tx) : user.membershipNumber
    return tx.user.update({
      where: { id: userId },
      data: {
        status,
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
    oldValue: { status: user.status },
    newValue: {
      status,
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

  if (role === 'ADMIN' && !actor.isSuperAdmin) {
    throw new Error('Only a Super Admin can assign the Admin role')
  }

  if (target.isSuperAdmin && !actor.isSuperAdmin) {
    throw new Error('Cannot change a Super Admin account')
  }

  if (target.isSuperAdmin && role !== 'ADMIN') {
    throw new Error('Demote Super Admin flag before changing primary role away from Admin')
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
  if (target.isSuperAdmin && !actor.isSuperAdmin) {
    throw new Error('Cannot change Super Admin dashboard access')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { dashboardAccess: dashboardAccess as Role[] },
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

  if ((target.role === 'ADMIN' || target.isSuperAdmin) && !actor.isSuperAdmin) {
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

export async function setSuperAdminFlag(input: z.infer<typeof superSchema>) {
  const actor = await requireAdmin()
  if (!actor.isSuperAdmin) {
    throw new Error('Only a Super Admin can change Super Admin flags')
  }

  const { userId, isSuperAdmin } = superSchema.parse(input)
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  if (!isSuperAdmin) {
    const supers = await prisma.user.count({ where: { isSuperAdmin: true } })
    if (supers <= 1 && target.isSuperAdmin) {
      throw new Error('Cannot remove the last Super Admin')
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isSuperAdmin,
      role: isSuperAdmin ? 'ADMIN' : target.role,
      dashboardAccess: isSuperAdmin ? (ALL_ROLES as Role[]) : target.dashboardAccess,
    },
  })

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: 'SUPER_ADMIN_FLAG',
    entity: 'User',
    entityId: userId,
    meta: { isSuperAdmin },
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
    include: { _count: { select: { attachedMembers: true } } },
  })
  if (!target) throw new Error('User not found')

  if (target.status !== 'ACTIVE' && isPrincipal) {
    throw new Error('Only ACTIVE members can be assigned as Principal')
  }

  if (target.principalMemberId && isPrincipal) {
    throw new Error('Detach this member from their current Principal before making them a Principal')
  }

  if (!isPrincipal && target._count.attachedMembers > 0) {
    throw new Error(
      `Cannot remove Principal status while ${target._count.attachedMembers} attached member(s) remain. Transfer or detach them first.`,
    )
  }

  const updated = await prisma.user.update({
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

  await syncUserMetadata(updated)

  await writeAudit({
    userId: actor.id,
    action: isPrincipal ? 'PRINCIPAL_ASSIGN' : 'PRINCIPAL_REVOKE',
    entity: 'User',
    entityId: userId,
    reason: reason || (isPrincipal ? 'Assigned as Principal Member' : 'Removed Principal status'),
    oldValue: { isPrincipal: target.isPrincipal },
    newValue: { isPrincipal },
    meta: { targetEmail: target.email, targetName: target.fullName },
  })

  revalidateAdmin()
  revalidatePath('/dashboard/member/family')
  return updated
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
  revalidatePath('/dashboard/member/family')
  return updated
}
