import type { FamilyRelationship, FamilyRegistrationState, MemberStatus } from '@prisma/client'

export type FamilyMemberState = {
  id: string
  isPrincipal: boolean
  principalMemberId: string | null
  familyRegistrationState: FamilyRegistrationState
  status: MemberStatus
}

export type PrincipalState = {
  id: string
  isPrincipal: boolean
  principalMemberId: string | null
  status: MemberStatus
}

export function validateFamilyAttachment(member: FamilyMemberState, principal: PrincipalState) {
  if (member.id === principal.id) throw new Error('A member cannot be attached to themselves')
  if (!principal.isPrincipal || principal.status !== 'ACTIVE' || principal.principalMemberId) {
    throw new Error('The selected branch owner is not an active Principal Member')
  }
  if (member.isPrincipal) throw new Error('A Principal Member cannot be attached under another branch')
  if (member.principalMemberId && member.principalMemberId !== principal.id) {
    throw new Error('This member already belongs to another Principal branch')
  }
}

export function validateFamilyTransfer(
  member: FamilyMemberState,
  currentPrincipalId: string,
  nextPrincipal: PrincipalState,
) {
  if (!member.principalMemberId || member.principalMemberId !== currentPrincipalId) {
    throw new Error('The member is no longer attached to the expected branch')
  }
  if (currentPrincipalId === nextPrincipal.id) {
    throw new Error('Select a different Principal Member for the transfer')
  }
  validateFamilyAttachment({ ...member, principalMemberId: null }, nextPrincipal)
}

export function branchHistoryData(input: {
  memberId: string
  fromPrincipalId?: string | null
  toPrincipalId: string
  relationship: FamilyRelationship
  approvedById: string
  reason: string
}) {
  return {
    memberId: input.memberId,
    fromPrincipalId: input.fromPrincipalId ?? null,
    toPrincipalId: input.toPrincipalId,
    relationship: input.relationship,
    approvedById: input.approvedById,
    reason: input.reason.trim(),
  }
}
