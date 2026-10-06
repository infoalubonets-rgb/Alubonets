'use server'

import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FamilyRelationship, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, syncUserMetadata } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { nextMembershipNumber } from '@/lib/membership'
import { branchHistoryData, validateFamilyAttachment } from '@/lib/family-rules'
import { notifyUsers } from '@/lib/notifications'
import { sendDirectEmails } from '@/lib/email/resend'
import { ALL_ROLES, ROLE_LABEL } from '@/lib/auth/types'

const RELATIONSHIPS = ['SPOUSE', 'SON', 'DAUGHTER', 'CHILD', 'DEPENDENT', 'OTHER'] as const
const relationshipLabel = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function refreshMembers() {
  for (const path of ['/directory', '/dashboard/member/family', '/admin', '/admin/roles', '/notifications']) revalidatePath(path)
}

/** Tells a member and their principal, in the app and by email, that they are now linked. */
async function announceAttachment(
  principal: { id: string; fullName: string; email: string },
  members: { id: string; fullName: string; email: string }[],
  actorId: string,
) {
  if (!members.length) return
  const names = members.map((member) => member.fullName)
  await notifyUsers({
    userIds: members.map((member) => member.id),
    title: `You were added to ${principal.fullName}’s family branch`,
    body: `${principal.fullName} is now your Principal Member.`,
    href: '/dashboard/member/family',
    type: 'FAMILY_ASSIGNED',
    entity: 'User',
    entityId: principal.id,
  })
  await notifyUsers({
    userIds: [principal.id],
    title: `${members.length} member${members.length === 1 ? '' : 's'} added to your family branch`,
    body: names.join(', '),
    href: '/dashboard/member/family',
    type: 'FAMILY_ASSIGNED',
    entity: 'User',
    entityId: principal.id,
  })
  const familyUrl = `${appUrl()}/dashboard/member/family`
  const realEmails = (list: { email: string }[]) => list.map((item) => item.email).filter((email) => !email.endsWith('@alubonets.local'))
  await sendDirectEmails({
    emails: realEmails(members),
    subject: `You were added to ${principal.fullName}’s family branch`,
    title: 'Family branch update',
    body: `<p>An administrator added you to <strong>${escapeHtml(principal.fullName)}</strong>’s family branch on Alubonets. ${escapeHtml(principal.fullName)} is now your Principal Member.</p>`,
    ctaLabel: 'View my family',
    ctaUrl: familyUrl,
    actorId,
    template: 'family_assigned_member',
  })
  await sendDirectEmails({
    emails: realEmails([principal]),
    subject: `New member${members.length === 1 ? '' : 's'} in your family branch`,
    title: 'Family branch update',
    body: `<p>An administrator added the following to your family branch:</p><ul>${names.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`,
    ctaLabel: 'View my family',
    ctaUrl: familyUrl,
    actorId,
    template: 'family_assigned_principal',
  })
}

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  phone: z.string().trim().min(7, 'Enter a phone number.').max(40),
  role: z.enum(ALL_ROLES as [Role, ...Role[]]).default('MEMBER'),
  isPrincipal: z.boolean().default(false),
  principalId: z.string().min(1).optional(),
  relationship: z.enum(RELATIONSHIPS).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/**
 * Admin adds a member directly: the account is approved now, gets a membership number, and the
 * person is emailed a link to create their login. They can be made a Principal, or attached to one.
 */
export async function adminCreateMember(input: z.input<typeof createMemberSchema>) {
  const actor = await requireAdmin()
  const data = createMemberSchema.parse(input)
  // Only a Super Admin can create, promote or demote Admins.
  if (data.role === 'ADMIN' && !actor.isSuperAdmin) throw new Error('Only a Super Admin can add an Administrator.')
  if (data.isPrincipal && data.principalId) throw new Error('A Principal Member cannot also be attached to another Principal.')
  if (data.principalId && !data.relationship) throw new Error('Choose how they are related to the Principal.')
  const dob = data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00Z`) : null
  if (dob && dob.getTime() > Date.now()) throw new Error('Date of birth cannot be in the future.')

  if (await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })) {
    throw new Error('A member with this email already exists.')
  }
  const principal = data.principalId ? await prisma.user.findUnique({ where: { id: data.principalId } }) : null
  if (data.principalId && !principal) throw new Error('Principal Member not found.')
  if (principal) validateFamilyAttachment({ id: '', isPrincipal: false, principalMemberId: null, familyRegistrationState: 'STANDARD', status: 'ACTIVE' }, principal)

  const token = createHash('sha256').update(randomBytes(32)).digest('hex')
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvalNotes: 'Added directly by an administrator',
        membershipNumber: await nextMembershipNumber(tx),
        isPrincipal: data.isPrincipal,
        principalMemberId: principal?.id ?? null,
        familyRelationship: principal ? (data.relationship as FamilyRelationship) : null,
        familyRegistrationState: principal ? 'ACTIVE_ATTACHED' : 'STANDARD',
        memberProfile: { create: { dateOfBirth: dob } },
      },
    })
    if (principal) {
      await tx.familyBranchHistory.create({
        data: branchHistoryData({
          memberId: user.id,
          toPrincipalId: principal.id,
          relationship: data.relationship as FamilyRelationship,
          approvedById: actor.id,
          reason: 'Added by an administrator',
        }),
      })
    }
    const invite = await tx.familyInvite.create({
      data: { token, userId: user.id, invitedById: actor.id, email: data.email, expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    })
    return { user, invite }
  })

  const registerUrl = `${appUrl()}/register?invite=${token}`
  const mail = await sendDirectEmails({
    emails: [data.email],
    subject: 'You have been added to Alubonets SHG',
    title: 'Welcome to Alubonets',
    body: `<p>An administrator added you as a <strong>${escapeHtml(ROLE_LABEL[data.role])}</strong>${
      principal ? ` in <strong>${escapeHtml(principal.fullName)}</strong>’s family branch` : ''
    }. Create your login to open the member portal. The link works for 14 days.</p>`,
    ctaLabel: 'Create my login',
    ctaUrl: registerUrl,
    actorId: actor.id,
    template: 'admin_member_invite',
  })
  if (principal) {
    // The new member's own welcome email already names their Principal; tell the Principal too.
    await notifyUsers({
      userIds: [principal.id],
      title: `${data.fullName} was added to your family branch`,
      body: `Relationship: ${relationshipLabel(data.relationship as string)}`,
      href: '/dashboard/member/family',
      type: 'FAMILY_ASSIGNED',
      entity: 'User',
      entityId: created.user.id,
    })
    if (!principal.email.endsWith('@alubonets.local')) {
      await sendDirectEmails({
        emails: [principal.email],
        subject: 'New member in your family branch',
        title: 'Family branch update',
        body: `<p>An administrator added <strong>${escapeHtml(data.fullName)}</strong> (${escapeHtml(relationshipLabel(data.relationship as string))}) to your family branch.</p>`,
        ctaLabel: 'View my family',
        ctaUrl: `${appUrl()}/dashboard/member/family`,
        actorId: actor.id,
        template: 'family_assigned_principal',
      })
    }
  }

  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_CREATE',
    entity: 'User',
    entityId: created.user.id,
    newValue: {
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      isPrincipal: data.isPrincipal,
      principalId: principal?.id ?? null,
      relationship: data.relationship ?? null,
    },
  })
  await syncUserMetadata(created.user)
  refreshMembers()
  return {
    id: created.user.id,
    membershipNumber: created.user.membershipNumber,
    emailed: mail.sent > 0,
    // Shown to the admin when email is not configured, so they can share it another way.
    registerUrl: mail.sent > 0 ? undefined : registerUrl,
  }
}

/** Members an admin can attach to a principal: active, not principals, not already in this branch. */
export async function listAssignableMembers(principalId: string) {
  await requireAdmin()
  const members = await prisma.user.findMany({
    where: { status: 'ACTIVE', isPrincipal: false, id: { not: principalId } },
    select: { id: true, fullName: true, email: true, principalMemberId: true, principal: { select: { fullName: true } } },
    orderBy: { fullName: 'asc' },
  })
  return members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    email: member.email.endsWith('@alubonets.local') ? '' : member.email,
    currentPrincipal: member.principalMemberId === principalId ? 'this' : member.principal?.fullName ?? null,
  }))
}

const assignSchema = z.object({
  principalId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(1, 'Tick at least one member.').max(200),
  relationship: z.enum(RELATIONSHIPS).default('OTHER'),
})

/** Attaches the ticked members to a principal (moving any from another branch) and tells everyone. */
export async function assignMembersToPrincipal(input: z.input<typeof assignSchema>) {
  const actor = await requireAdmin()
  const data = assignSchema.parse(input)
  const principal = await prisma.user.findUnique({ where: { id: data.principalId } })
  if (!principal) throw new Error('Principal Member not found.')
  const members = await prisma.user.findMany({ where: { id: { in: data.memberIds } } })

  const moved: typeof members = []
  for (const member of members) {
    if (member.principalMemberId === principal.id) continue
    validateFamilyAttachment({ ...member, principalMemberId: null }, principal)
    const fromPrincipalId = member.principalMemberId
    const updated = await prisma.$transaction(async (tx) => {
      const attached = await tx.user.update({
        where: { id: member.id },
        data: {
          principalMemberId: principal.id,
          familyRelationship: data.relationship as FamilyRelationship,
          familyRegistrationState: member.familyRegistrationState === 'RECORD_ONLY' ? 'RECORD_ONLY' : 'ACTIVE_ATTACHED',
        },
      })
      await tx.familyBranchHistory.create({
        data: branchHistoryData({
          memberId: member.id,
          fromPrincipalId,
          toPrincipalId: principal.id,
          relationship: data.relationship as FamilyRelationship,
          approvedById: actor.id,
          reason: 'Assigned by an administrator from the Members page',
        }),
      })
      return attached
    })
    await writeAudit({
      userId: actor.id,
      action: fromPrincipalId ? 'FAMILY_BRANCH_TRANSFER' : 'FAMILY_BRANCH_ASSIGN',
      entity: 'User',
      entityId: member.id,
      oldValue: { principalMemberId: fromPrincipalId },
      newValue: { principalMemberId: principal.id, familyRelationship: data.relationship },
      meta: { memberName: member.fullName, principalName: principal.fullName },
    })
    await syncUserMetadata(updated)
    moved.push(member)
  }

  await announceAttachment(principal, moved, actor.id)
  refreshMembers()
  return { assigned: moved.length, skipped: members.length - moved.length }
}

/** Detaches a member from their principal; they become an independent member. */
export async function removeFromPrincipal(input: { memberId: string }) {
  const actor = await requireAdmin()
  const { memberId } = z.object({ memberId: z.string().min(1) }).parse(input)
  const member = await prisma.user.findUnique({ where: { id: memberId }, include: { principal: { select: { id: true, fullName: true } } } })
  if (!member?.principalMemberId) throw new Error('This member is not attached to a Principal.')
  const updated = await prisma.user.update({
    where: { id: member.id },
    data: { principalMemberId: null, familyRelationship: null, familyRegistrationState: 'STANDARD' },
  })
  await writeAudit({
    userId: actor.id,
    action: 'FAMILY_BRANCH_REMOVE',
    entity: 'User',
    entityId: member.id,
    oldValue: { principalMemberId: member.principalMemberId },
    newValue: { principalMemberId: null },
    meta: { memberName: member.fullName, principalName: member.principal?.fullName },
  })
  await notifyUsers({
    userIds: [member.id, member.principalMemberId],
    title: `${member.fullName} was removed from ${member.principal?.fullName ?? 'a'} family branch`,
    href: '/dashboard/member/family',
    type: 'FAMILY_REMOVED',
    entity: 'User',
    entityId: member.id,
  })
  await syncUserMetadata(updated)
  refreshMembers()
}
