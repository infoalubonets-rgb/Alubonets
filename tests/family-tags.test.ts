import { describe, expect, it } from 'vitest'
import { familyTag } from '@/lib/family-tags'
import { formatMemberId } from '@/lib/membership'

describe('member IDs', () => {
  it('use AL + approval YYMM + a 3-digit counter', () => {
    expect(formatMemberId(2026, 8, 1)).toBe('AL2608-001')
    expect(formatMemberId(2027, 1, 42)).toBe('AL2701-042')
  })
  it('keep counting past 999 instead of breaking', () => {
    expect(formatMemberId(2026, 12, 1000)).toBe('AL2612-1000')
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
