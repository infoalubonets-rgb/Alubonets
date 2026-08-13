import { describe, expect, it } from 'vitest'
import { branchHistoryData, validateFamilyAttachment, validateFamilyTransfer } from '../lib/family-rules'

const principal = {
  id: 'principal-a',
  isPrincipal: true,
  principalMemberId: null,
  status: 'ACTIVE' as const,
}

const unattachedMember = {
  id: 'member-a',
  isPrincipal: false,
  principalMemberId: null,
  familyRegistrationState: 'STANDARD' as const,
  status: 'ACTIVE' as const,
}

describe('family hierarchy rules', () => {
  it('allows an ordinary member to join an active Principal branch', () => {
    expect(() => validateFamilyAttachment(unattachedMember, principal)).not.toThrow()
  })

  it('prevents self-links and attaching a Principal under another Principal', () => {
    expect(() => validateFamilyAttachment({ ...unattachedMember, id: principal.id }, principal)).toThrow(/themselves/)
    expect(() => validateFamilyAttachment({ ...unattachedMember, isPrincipal: true }, principal)).toThrow(/Principal Member/)
  })

  it('prevents a Principal from taking a member already attached elsewhere', () => {
    expect(() => validateFamilyAttachment({ ...unattachedMember, principalMemberId: 'principal-b' }, principal)).toThrow(/another Principal/)
  })

  it('requires transfers to use the expected current branch and a different active Principal', () => {
    const attached = { ...unattachedMember, principalMemberId: principal.id }
    expect(() => validateFamilyTransfer(attached, principal.id, principal)).toThrow(/different Principal/)
    expect(() => validateFamilyTransfer(attached, 'wrong-principal', { ...principal, id: 'principal-b' })).toThrow(/no longer attached/)
    expect(() => validateFamilyTransfer(attached, principal.id, { ...principal, id: 'principal-b' })).not.toThrow()
  })

  it('creates complete immutable branch-history data', () => {
    expect(branchHistoryData({
      memberId: 'member-a',
      fromPrincipalId: 'principal-a',
      toPrincipalId: 'principal-b',
      relationship: 'DEPENDENT',
      approvedById: 'admin-a',
      reason: '  Committee approved transfer  ',
    })).toEqual({
      memberId: 'member-a',
      fromPrincipalId: 'principal-a',
      toPrincipalId: 'principal-b',
      relationship: 'DEPENDENT',
      approvedById: 'admin-a',
      reason: 'Committee approved transfer',
    })
  })
})
