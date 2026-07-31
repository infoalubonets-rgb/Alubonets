'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, syncUserMetadata } from '@/lib/auth/session'
import { sendMemberApprovedEmail } from '@/lib/email/resend'
import type { Role } from '@prisma/client'
import { ALL_ROLES } from '@/lib/auth/types'
import { writeAudit } from '@/lib/audit'
import { nextMembershipNumber } from '@/lib/membership'

const approveSchema = z.object({
  userId: z.string().min(1),
  approve: z.boolean(),
  note: z.string().trim().min(3).max(1000),
  identityVerified: z.boolean(),
})

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
  const { userId, approve, note, identityVerified } = approveSchema.parse(input)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.rejectedAt) throw new Error('This application was permanently rejected and cannot be reopened.')
  if (approve && !identityVerified) throw new Error('Confirm identity verification before approval.')

  const status = approve ? 'ACTIVE' : 'INACTIVE'
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
      },
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
