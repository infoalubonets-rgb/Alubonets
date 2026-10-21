import { describe, expect, it } from 'vitest'
import { familyTag } from '@/lib/family-tags'
import { formatMemberId } from '@/lib/membership'

describe('member IDs', () => {
  it('use AL + approval YYMMDD + the system-wide member number', () => {
    expect(formatMemberId(2026, 10, 3, 6)).toBe('AL261003-006')
    expect(formatMemberId(2027, 1, 21, 42)).toBe('AL270121-042')
  })
  it('keep counting past 999 instead of breaking', () => {
    expect(formatMemberId(2026, 12, 31, 1000)).toBe('AL261231-1000')
  })
})

describe('family tags', () => {
  it('shows the family code for a Principal', () => {
    expect(familyTag({ isPrincipal: true, familyCode: 'PJW', familyMemberNumber: null })).toBe('PJW')
  })
  it('numbers attached members after their Principal’s code', () => {
    const principal = { familyCode: 'PJW' }
    expect(familyTag({ isPrincipal: false, familyCode: null, familyMemberNumber: 1, principal })).toBe('PJW01')
    expect(familyTag({ isPrincipal: false, familyCode: null, familyMemberNumber: 12, principal })).toBe('PJW12')
  })
  it('adds a dash when the family code ends in a clash number', () => {
    const principal = { familyCode: 'PJW2' }
    expect(familyTag({ isPrincipal: false, familyCode: null, familyMemberNumber: 3, principal })).toBe('PJW2-03')
  })
  it('has no tag outside a family', () => {
    expect(familyTag({ isPrincipal: false, familyCode: null, familyMemberNumber: null, principal: null })).toBeNull()
  })
})
