import { prisma } from '@/lib/prisma'

export function familyInviteStatus(invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()) {
  if (invite.acceptedAt) return 'ACCEPTED' as const
  if (invite.revokedAt) return 'REVOKED' as const
  if (invite.expiresAt <= now) return 'EXPIRED' as const
  return 'PENDING' as const
}

export async function getFamilyInviteByToken(token: string) {
  if (!token) return null
  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          principalMemberId: true,
          familyRelationship: true,
          memberProfile: { select: { familyBranch: true } },
        },
      },
      invitedBy: { select: { fullName: true } },
    },
  })
  if (!invite) return null
  const status = familyInviteStatus(invite)
  if (status === 'ACCEPTED' || status === 'REVOKED') return null
  if (status === 'EXPIRED') {
    const recorded = await prisma.familyAccountTransition.findFirst({
      where: { inviteId: invite.id, type: 'INVITE_EXPIRED' }, select: { id: true },
    })
    if (!recorded) {
      await prisma.familyAccountTransition.create({ data: {
        memberId: invite.userId, inviteId: invite.id, type: 'INVITE_EXPIRED',
        fromState: 'INVITED', toState: 'INVITED', reason: 'Login invitation expired without acceptance',
      } })
    }
    return null
  }
  return invite
}

export async function markFamilyInviteAccepted(token: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.familyInvite.findUnique({ where: { token } })
    if (!invite || invite.userId !== userId || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
      throw new Error('This family invite is no longer valid')
    }
    const member = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    const acceptedAt = new Date()
    await tx.familyInvite.update({ where: { id: invite.id }, data: { acceptedAt } })
    // An Admin-invited member is already active; keep the state registration gave them.
    const toState = member.status === 'ACTIVE' ? member.familyRegistrationState : 'INVITED'
    await tx.user.update({ where: { id: userId }, data: { familyRegistrationState: toState } })
    await tx.familyAccountTransition.create({ data: {
      memberId: userId, actorId: userId, inviteId: invite.id, type: 'INVITE_ACCEPTED',
      fromState: member.familyRegistrationState, toState,
      reason: 'Attached member accepted the login invitation', occurredAt: acceptedAt,
    } })
    return invite
  })
}
