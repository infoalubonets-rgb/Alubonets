'use server'

import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { publicErrorMessage } from '@/lib/safe-error'
import type { FamilyRelationship, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, syncUserMetadata } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { nextMembershipNumber } from '@/lib/membership'
import { branchHistoryData, validateFamilyAttachment } from '@/lib/family-rules'
import { notifyUsers } from '@/lib/notifications'
import { sendDirectEmails } from '@/lib/email/resend'
import { sendMemberSetupEmail } from '@/lib/email/member-setup'
import { ALL_ROLES, ROLE_LABEL } from '@/lib/auth/types'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'
import { ADMIN_CREATED_NOTE } from '@/lib/profile-completion'

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

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined)

/** Optional details an admin may fill now; the member completes the rest from My profile. */
const profileSchema = z
  .object({
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional().or(z.literal('').transform(() => undefined)),
    location: optionalText(120),
    address: optionalText(200),
    nextOfKinName: optionalText(120),
    nextOfKinPhone: optionalText(40),
    nextOfKinRelationship: optionalText(60),
    emergencyContactName: optionalText(120),
    emergencyContactPhone: optionalText(40),
    profession: optionalText(120),
    educationLevel: z
      .enum(['PRIMARY', 'SECONDARY', 'CERTIFICATE', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE', 'OTHER'])
      .optional()
      .or(z.literal('').transform(() => undefined)),
    skills: optionalText(500),
    achievements: optionalText(500),
    mentorshipArea: optionalText(200),
    interests: optionalText(500),
  })
  .default({})

const createMemberSchema = z
  .object({
    /** Minors get a family record without a login, email or password. */
    isMinor: z.boolean().default(false),
    fullName: z.string().trim().min(2, 'Enter the full name.').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email.').optional().or(z.literal('').transform(() => undefined)),
    phone: optionalText(40),
    /** Temporary password set by the admin; the member replaces it from the setup link. */
    password: z.string().min(8, 'The temporary password must be at least 8 characters.').max(72).optional().or(z.literal('').transform(() => undefined)),
    role: z.enum(ALL_ROLES as [Role, ...Role[]]).default('MEMBER'),
    isPrincipal: z.boolean().default(false),
    principalId: z.string().min(1).optional(),
    relationship: z.enum(RELATIONSHIPS).optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
    profile: profileSchema,
  })
  .superRefine((data, ctx) => {
    if (data.isMinor) return
    if (!data.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter their email address.' })
    if (!data.phone || data.phone.length < 7) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a phone number.' })
    if (!data.password) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Set a temporary password (at least 8 characters).' })
  })

/** Where an admin-created member sets their own password; the token is the key. */
const setupUrlFor = (token: string) => `${appUrl()}/account-setup?token=${token}`

/**
 * Admin adds a member directly; the account is approved now and gets a membership number.
 *
 * - **Adult:** a login is created with the admin's temporary password (email already confirmed),
 *   and a setup link is emailed and returned to copy. Opening it lets the member choose their own
 *   password with no email code; after signing in they are asked to complete My profile.
 * - **Minor:** a family record without a login; the admin may fill any of the details.
 */
export type CreateMemberResult =
  | ({ ok: true } & Awaited<ReturnType<typeof createMember>>)
  | { ok: false; error: string }

/**
 * Errors thrown by a server action reach the browser as a generic "An error occurred in the
 * Server Components render" in production, so the reason is returned as data instead.
 */
export async function adminCreateMember(input: z.input<typeof createMemberSchema>): Promise<CreateMemberResult> {
  try {
    return { ok: true, ...(await createMember(input)) }
  } catch (cause) {
    unstable_rethrow(cause)
    if (cause instanceof z.ZodError) return { ok: false, error: cause.issues[0]?.message || 'Check the form details.' }
    logError('member_admin.create_failed', cause)
    return { ok: false, error: publicErrorMessage(cause, 'Could not add the member. Please try again.') }
  }
}

async function createMember(input: z.input<typeof createMemberSchema>) {
  const actor = await requireAdmin()
  const data = createMemberSchema.parse(input)
  const role: Role = data.isMinor ? 'MEMBER' : data.role
  // Only a Super Admin can create, promote or demote Admins.
  if (role === 'ADMIN' && !actor.isSuperAdmin) throw new Error('Only a Super Admin can add an Administrator.')
  if (data.isMinor && data.isPrincipal) throw new Error('A minor cannot be a Principal Member.')
  if (data.isPrincipal && data.principalId) throw new Error('A Principal Member cannot also be attached to another Principal.')
  if (data.principalId && !data.relationship) throw new Error('Choose how they are related to the Principal.')
  const dob = data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00Z`) : null
  if (dob && dob.getTime() > Date.now()) throw new Error('Date of birth cannot be in the future.')

  const email = data.isMinor
    ? data.email || `record+${randomBytes(8).toString('hex')}@alubonets.local`
    : data.email!
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true, authUserId: true, _count: { select: { consentRecords: true } } },
  })
  // A sign-up that never submitted the application (typically a first "Continue with Google")
  // holds no member data, so the admin's record takes it over instead of failing. The person
  // keeps their existing login, Google included.
  const unfinished =
    existing && !data.isMinor && existing.status === 'PENDING' && existing._count.consentRecords === 0 ? existing : null
  if (existing && !unfinished) {
    throw new Error('A member with this email already exists. Find them in the Directory instead.')
  }
  const principal = data.principalId ? await prisma.user.findUnique({ where: { id: data.principalId } }) : null
  if (data.principalId && !principal) throw new Error('Principal Member not found.')
  if (principal) validateFamilyAttachment({ id: '', isPrincipal: false, principalMemberId: null, familyRegistrationState: 'STANDARD', status: 'ACTIVE' }, principal)

  // Adults get their login straight away, already confirmed, with the temporary password.
  let authUserId: string | null = null
  let createdLoginHere = false
  if (!data.isMinor && unfinished?.authUserId) {
    // Reuse the unfinished sign-up's login; the temporary password is added to it.
    const { error } = await createServiceClient().auth.admin.updateUserById(unfinished.authUserId, {
      password: data.password!,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    })
    if (error) throw new Error(`Could not update the existing login: ${error.message}`)
    authUserId = unfinished.authUserId
  } else if (!data.isMinor) {
    const service = createServiceClient()
    const { data: createdAuth, error } = await service.auth.admin.createUser({
      email,
      password: data.password!,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    })
    if (error || !createdAuth.user) {
      throw new Error(
        error?.message?.toLowerCase().includes('already')
          ? 'A login already exists for this email in Supabase but has no member record. Remove it under Supabase → Authentication → Users, then try again.'
          : `Could not create the login: ${error?.message ?? 'unknown error'}`,
      )
    }
    authUserId = createdAuth.user.id
    createdLoginHere = true
  }

  const { location, ...profileFields } = data.profile
  const token = createHash('sha256').update(randomBytes(32)).digest('hex')
  let created
  try {
    created = await prisma.$transaction(async (tx) => {
      const fields = {
        fullName: data.fullName,
        phone: data.phone ?? null,
        location: location ?? null,
        role,
        // Record-only minors follow the family convention: no login, so not an active account.
        status: data.isMinor ? ('INACTIVE' as const) : ('ACTIVE' as const),
        approvedAt: new Date(),
        approvalNotes: ADMIN_CREATED_NOTE,
        membershipNumber: await nextMembershipNumber(tx),
        authUserId,
        isPrincipal: data.isPrincipal,
        principalMemberId: principal?.id ?? null,
        familyRelationship: principal ? (data.relationship as FamilyRelationship) : null,
        familyRegistrationState: data.isMinor ? ('RECORD_ONLY' as const) : principal ? ('ACTIVE_ATTACHED' as const) : ('STANDARD' as const),
      }
      const user = unfinished
        ? await tx.user.update({
            where: { id: unfinished.id },
            data: {
              ...fields,
              memberProfile: {
                upsert: { create: { dateOfBirth: dob, ...profileFields }, update: { dateOfBirth: dob, ...profileFields } },
              },
            },
          })
        : await tx.user.create({
            data: { ...fields, email, memberProfile: { create: { dateOfBirth: dob, ...profileFields } } },
          })
      if (principal) {
        await tx.familyBranchHistory.create({
          data: branchHistoryData({
            memberId: user.id,
            toPrincipalId: principal.id,
            relationship: data.relationship as FamilyRelationship,
            approvedById: actor.id,
            reason: data.isMinor ? 'Minor added by an administrator' : 'Added by an administrator',
          }),
        })
      }
      if (!data.isMinor) {
        await tx.familyInvite.create({
          data: { token, userId: user.id, invitedById: actor.id, email, expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
        })
      }
      return user
    })
  } catch (cause) {
    // Never leave a login without its member record (only one created just now; a reused one stays).
    if (authUserId && createdLoginHere) await createServiceClient().auth.admin.deleteUser(authUserId).catch(() => {})
    throw cause
  }

  const setupUrl = data.isMinor ? null : setupUrlFor(token)
  // Includes the temporary password and the setup link; never throws, and reports what happened.
  const mail = setupUrl
    ? await sendMemberSetupEmail({
        userId: created.id,
        actorId: actor.id,
        to: email,
        fullName: data.fullName,
        roleLabel: ROLE_LABEL[role],
        principalName: principal?.fullName ?? null,
        setupUrl,
        temporaryPassword: data.password!,
      })
    : null
  if (principal) {
    await notifyUsers({
      userIds: [principal.id],
      title: `${data.fullName} was added to your family branch`,
      body: `Relationship: ${relationshipLabel(data.relationship as string)}`,
      href: '/dashboard/member/family',
      type: 'FAMILY_ASSIGNED',
      entity: 'User',
      entityId: created.id,
    })
    if (!principal.email.endsWith('@alubonets.local')) {
      // The member already exists; a mail outage here must not turn into a failed "Add member".
      await sendDirectEmails({
        emails: [principal.email],
        subject: 'New member in your family branch',
        title: 'Family branch update',
        body: `<p>An administrator added <strong>${escapeHtml(data.fullName)}</strong> (${escapeHtml(relationshipLabel(data.relationship as string))}) to your family branch.</p>`,
        ctaLabel: 'View my family',
        ctaUrl: `${appUrl()}/dashboard/member/family`,
        actorId: actor.id,
        template: 'family_assigned_principal',
      }).catch((cause) => logError('member_admin.principal_email_failed', cause, { memberId: created.id }))
    }
  }

  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_CREATE',
    entity: 'User',
    entityId: created.id,
    newValue: {
      fullName: data.fullName,
      email: data.isMinor ? null : email,
      role,
      minor: data.isMinor,
      isPrincipal: data.isPrincipal,
      principalId: principal?.id ?? null,
      relationship: data.relationship ?? null,
    },
  })
  if (!data.isMinor) await syncUserMetadata(created)
  refreshMembers()
  return {
    id: created.id,
    membershipNumber: created.membershipNumber,
    minor: data.isMinor,
    emailed: Boolean(mail?.sent),
    /** Where the email actually went (the test inbox when RESEND_TEST_EMAIL is set). */
    emailedTo: mail?.sent ? mail.deliveredTo : null,
    emailRedirectedToTestInbox: mail?.sent ? mail.redirectedToTestInbox : false,
    emailError: mail && !mail.sent ? mail.error : null,
    /** Always returned for adults so the admin can copy and share it. */
    setupUrl,
  }
}

/** Issues a fresh 14-day setup link for an admin-created member who has not finished setup yet. */
export async function adminNewSetupLink(userId: string) {
  const actor = await requireAdmin()
  const user = await prisma.user.findUnique({ where: { id: z.string().min(1).parse(userId) }, select: { id: true, email: true, authUserId: true } })
  if (!user?.authUserId || user.email.endsWith('@alubonets.local')) throw new Error('This member has no login to set up.')
  const token = createHash('sha256').update(randomBytes(32)).digest('hex')
  await prisma.$transaction([
    prisma.familyInvite.updateMany({ where: { userId: user.id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.familyInvite.create({ data: { token, userId: user.id, invitedById: actor.id, email: user.email, expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } }),
  ])
  await writeAudit({ userId: actor.id, action: 'MEMBER_SETUP_LINK', entity: 'User', entityId: user.id })
  return { setupUrl: setupUrlFor(token) }
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
