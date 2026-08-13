'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FamilyRelationship } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { sendFamilyInviteEmail, sendFamilyLinkedNoticeEmail } from '@/lib/email/resend'
import { getFamilyInviteByToken, markFamilyInviteAccepted } from '@/lib/family-invite'
import { branchHistoryData, validateFamilyAttachment } from '@/lib/family-rules'
import { assertEligibleForAdultInvite } from '@/lib/family-transition'
import { getSetting, SETTING_KEYS } from '@/lib/settings'

export { getFamilyInviteByToken, markFamilyInviteAccepted }

const relationshipEnum = z.enum(['SPOUSE', 'CHILD', 'DEPENDENT', 'OTHER'])

const linkSchema = z.object({
  email: z.string().email(),
  relationship: relationshipEnum,
})

const createSchema = z.object({
  mode: z.enum(['INVITE_NEW', 'RECORD_ONLY']),
  fullName: z.string().trim().min(2).max(120),
  relationship: relationshipEnum,
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().trim().min(7, 'Phone number is required').max(40),
  dateOfBirth: z.string().optional().or(z.literal('')),
  lineage: z.string().trim().max(250).optional().or(z.literal('')),
})

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
}

function inviteToken() {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

async function requirePrincipal() {
  const actor = await requireActiveRole(['MEMBER', 'ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER'])
  const me = await prisma.user.findUnique({ where: { id: actor.id } })
  if (!me?.isPrincipal || me.status !== 'ACTIVE') {
    throw new Error('Only an active Principal Member can manage a family branch')
  }
  return me
}

function revalidateFamily() {
  revalidatePath('/dashboard/member/family')
  revalidatePath('/dashboard/member')
  revalidatePath('/admin/members')
}

export async function linkExistingFamilyMember(input: z.infer<typeof linkSchema>) {
  const principal = await requirePrincipal()
  const { email, relationship } = linkSchema.parse(input)
  const normalized = email.trim().toLowerCase()

  const target = await prisma.user.findUnique({ where: { email: normalized } })
  if (!target) throw new Error('No member found with that email')
  validateFamilyAttachment(target, principal)
  if (target.principalMemberId === principal.id) {
    throw new Error('That member is already attached to your family branch')
  }
  if (target.familyRegistrationState === 'RECORD_ONLY') {
    throw new Error('That record is record-only and cannot be linked as a login member this way')
  }
  if (!['ACTIVE', 'PENDING'].includes(target.status)) {
    throw new Error('Only ACTIVE or PENDING members can be linked')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const member = await tx.user.update({
      where: { id: target.id },
      data: {
        principalMemberId: principal.id,
        familyRelationship: relationship as FamilyRelationship,
        familyRegistrationState: target.status === 'ACTIVE' ? 'ACTIVE_ATTACHED' : 'INVITED',
      },
    })
    await tx.familyBranchHistory.create({
      data: branchHistoryData({
        memberId: target.id,
        fromPrincipalId: target.principalMemberId,
        toPrincipalId: principal.id,
        relationship: relationship as FamilyRelationship,
        approvedById: principal.id,
        reason: 'Principal linked an existing member to the branch',
      }),
    })
    return member
  })

  await writeAudit({
    userId: principal.id,
    action: 'FAMILY_LINK_EXISTING',
    entity: 'User',
    entityId: target.id,
    reason: `Linked as ${relationship} under Principal`,
    oldValue: { principalMemberId: target.principalMemberId },
    newValue: { principalMemberId: principal.id, familyRelationship: relationship },
  })

  await sendFamilyLinkedNoticeEmail({
    member: updated,
    principalName: principal.fullName,
  })

  revalidateFamily()
  return { ok: true as const, memberId: updated.id }
}

export async function createAttachedMember(input: z.infer<typeof createSchema>) {
  const principal = await requirePrincipal()
  const data = createSchema.parse(input)

  const parsedDob = data.dateOfBirth ? new Date(data.dateOfBirth) : null
  const duplicate = await prisma.user.findFirst({
    where: {
      principalMemberId: principal.id,
      fullName: { equals: data.fullName, mode: 'insensitive' },
      ...(parsedDob && !Number.isNaN(parsedDob.getTime())
        ? { memberProfile: { is: { dateOfBirth: parsedDob } } }
        : {}),
    },
    select: { id: true },
  })
  if (duplicate) {
    throw new Error('A family member with this name is already attached to your branch')
  }

  if (data.mode === 'INVITE_NEW') {
    const email = (data.email || '').trim().toLowerCase()
    if (!email) throw new Error('Email is required to send an invite')

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing?.authUserId && existing.status === 'ACTIVE') {
      throw new Error('An active account already exists for that email. Use “Link existing member”.')
    }
    if (existing?.principalMemberId && existing.principalMemberId !== principal.id) {
      throw new Error('That email is already attached under another Principal')
    }

    const token = inviteToken()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const user =
        existing ??
        (await tx.user.create({
          data: {
            email,
            fullName: data.fullName,
            phone: data.phone || null,
            role: 'MEMBER',
            status: 'PENDING',
            isPrincipal: false,
            principalMemberId: principal.id,
            familyRelationship: data.relationship as FamilyRelationship,
            familyRegistrationState: 'INVITED',
          },
        }))

      if (existing) {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            fullName: data.fullName,
            phone: data.phone || existing.phone,
            principalMemberId: principal.id,
            familyRelationship: data.relationship as FamilyRelationship,
            familyRegistrationState: 'INVITED',
            status: existing.status === 'ACTIVE' ? existing.status : 'PENDING',
          },
        })
      }

      if (data.dateOfBirth) {
        const dob = new Date(data.dateOfBirth)
        if (!Number.isNaN(dob.getTime())) {
          await tx.memberProfile.upsert({
            where: { userId: user.id },
            create: { userId: user.id, dateOfBirth: dob, familyBranch: data.lineage || null },
            update: { dateOfBirth: dob, familyBranch: data.lineage || undefined },
          })
        }
      }

      await tx.familyInvite.updateMany({
        where: { userId: user.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      const invite = await tx.familyInvite.create({
        data: {
          token,
          userId: user.id,
          invitedById: principal.id,
          email,
          expiresAt,
        },
      })
      await tx.familyAccountTransition.create({ data: {
        memberId: user.id, actorId: principal.id, inviteId: invite.id, type: 'INVITED',
        fromState: existing?.familyRegistrationState || 'STANDARD', toState: 'INVITED',
        dateOfBirth: parsedDob, reason: 'Principal invited an attached adult to activate a login',
      } })

      if (!existing?.principalMemberId) {
        await tx.familyBranchHistory.create({
          data: branchHistoryData({
            memberId: user.id,
            toPrincipalId: principal.id,
            relationship: data.relationship as FamilyRelationship,
            approvedById: principal.id,
            reason: 'Principal created and invited an attached family member',
          }),
        })
      }

      return { userId: user.id, invite }
    })

    const inviteUrl = `${appUrl()}/register?invite=${result.invite.token}`
    const mail = await sendFamilyInviteEmail({
      toEmail: email,
      fullName: data.fullName,
      principalName: principal.fullName,
      inviteUrl,
      userId: result.userId,
    })

    await writeAudit({
      userId: principal.id,
      action: 'FAMILY_INVITE_CREATE',
      entity: 'FamilyInvite',
      entityId: result.invite.id,
      reason: `Invited ${data.fullName} as ${data.relationship}`,
      newValue: { email, relationship: data.relationship, expiresAt },
    })

    revalidateFamily()
    return {
      ok: true as const,
      mode: 'INVITE_NEW' as const,
      memberId: result.userId,
      inviteUrl: mail.skipped || mail.testMode ? inviteUrl : undefined,
      emailSkipped: Boolean(mail.skipped),
      deliveredTo: mail.deliveredTo,
      emailAccepted: Boolean(mail.accepted),
      testMode: Boolean(mail.testMode),
      providerMessageId: mail.providerMessageId,
    }
  }

  // RECORD_ONLY
  const email =
    (data.email || '').trim().toLowerCase() ||
    `record+${randomBytes(8).toString('hex')}@alubonets.local`

  if (!email.endsWith('@alubonets.local')) {
    const taken = await prisma.user.findUnique({ where: { email } })
    if (taken) throw new Error('That email is already in use. Use invite or link instead.')
  }

  const user = await prisma.$transaction(async (tx) => {
    const member = await tx.user.create({
      data: {
        email,
        fullName: data.fullName,
        phone: data.phone || null,
        role: 'MEMBER',
        status: 'INACTIVE',
        isPrincipal: false,
        principalMemberId: principal.id,
        familyRelationship: data.relationship as FamilyRelationship,
        familyRegistrationState: 'RECORD_ONLY',
        memberProfile: data.dateOfBirth || data.lineage
          ? {
              create: {
                dateOfBirth: !data.dateOfBirth || Number.isNaN(new Date(data.dateOfBirth).getTime())
                  ? undefined
                  : new Date(data.dateOfBirth),
                familyBranch: data.lineage || null,
              },
            }
          : undefined,
      },
    })
    await tx.familyBranchHistory.create({
      data: branchHistoryData({
        memberId: member.id,
        toPrincipalId: principal.id,
        relationship: data.relationship as FamilyRelationship,
        approvedById: principal.id,
        reason: 'Principal created a record-only family member',
      }),
    })
    await tx.familyAccountTransition.create({ data: {
      memberId: member.id, actorId: principal.id, type: 'RECORD_CREATED',
      fromState: 'STANDARD', toState: 'RECORD_ONLY', dateOfBirth: parsedDob,
      reason: 'Principal created a record-only family member',
    } })
    return member
  })

  await writeAudit({
    userId: principal.id,
    action: 'FAMILY_RECORD_ONLY_CREATE',
    entity: 'User',
    entityId: user.id,
    reason: `Record-only ${data.relationship}: ${data.fullName}`,
    newValue: {
      fullName: data.fullName,
      relationship: data.relationship,
      familyRegistrationState: 'RECORD_ONLY',
    },
  })

  revalidateFamily()
  return { ok: true as const, mode: 'RECORD_ONLY' as const, memberId: user.id }
}

export async function revokeFamilyInvite(inviteId: string) {
  const principal = await requirePrincipal()
  const invite = await prisma.familyInvite.findUnique({ where: { id: inviteId } })
  if (!invite || invite.invitedById !== principal.id) throw new Error('Invite not found')
  if (invite.acceptedAt) throw new Error('Invite already accepted')
  if (invite.revokedAt) throw new Error('Invite already revoked')

  await prisma.$transaction(async (tx) => {
    await tx.familyInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } })
    const member = await tx.user.findUniqueOrThrow({ where: { id: invite.userId } })
    await tx.familyAccountTransition.create({ data: {
      memberId: invite.userId, actorId: principal.id, inviteId, type: 'INVITE_REVOKED',
      fromState: member.familyRegistrationState, toState: member.familyRegistrationState,
      reason: 'Principal revoked family invite',
    } })
  })

  await writeAudit({
    userId: principal.id,
    action: 'FAMILY_INVITE_REVOKE',
    entity: 'FamilyInvite',
    entityId: inviteId,
    reason: 'Principal revoked family invite',
  })

  revalidateFamily()
  return { ok: true as const }
}

export async function inviteRecordOnlyAdult(input: { memberId: string; email: string }) {
  const principal = await requirePrincipal()
  const email = z.string().email().parse(input.email.trim().toLowerCase())
  const member = await prisma.user.findFirst({
    where: { id: input.memberId, principalMemberId: principal.id },
    include: { memberProfile: { select: { dateOfBirth: true } } },
  })
  if (!member || member.familyRegistrationState !== 'RECORD_ONLY') throw new Error('Record-only family member not found')
  const adulthoodAge = Number(await getSetting(SETTING_KEYS.familyAdulthoodAge))
  assertEligibleForAdultInvite(member.memberProfile?.dateOfBirth || null, adulthoodAge)
  const emailOwner = await prisma.user.findUnique({ where: { email } })
  if (emailOwner && emailOwner.id !== member.id) throw new Error('That email is already used by another member')
  const token = inviteToken()
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const invite = await prisma.$transaction(async (tx) => {
    await tx.familyInvite.updateMany({
      where: { userId: member.id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() },
    })
    await tx.user.update({ where: { id: member.id }, data: { email, status: 'PENDING', familyRegistrationState: 'INVITED' } })
    const created = await tx.familyInvite.create({ data: { token, userId: member.id, invitedById: principal.id, email, expiresAt } })
    await tx.familyAccountTransition.create({ data: {
      memberId: member.id, actorId: principal.id, inviteId: created.id, type: 'INVITED',
      fromState: 'RECORD_ONLY', toState: 'INVITED', adulthoodAge,
      dateOfBirth: member.memberProfile?.dateOfBirth, reason: `Record-only child reached the configured adulthood threshold (${adulthoodAge})`,
    } })
    return created
  })
  const inviteUrl = `${appUrl()}/register?invite=${invite.token}`
  const mail = await sendFamilyInviteEmail({ toEmail: email, fullName: member.fullName, principalName: principal.fullName, inviteUrl, userId: member.id })
  await writeAudit({ userId: principal.id, action: 'FAMILY_ADULT_TRANSITION_INVITE', entity: 'FamilyInvite', entityId: invite.id, newValue: { memberId: member.id, adulthoodAge, email } })
  revalidateFamily()
  return { ok: true as const, inviteUrl: mail.skipped ? inviteUrl : undefined }
}
