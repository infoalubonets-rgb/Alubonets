import { describe, expect, it } from 'vitest'
import { familyMemberList, familyDetailView, type FamilyDetailMember } from '../lib/family-details'

const member: FamilyDetailMember = {
  id: 'member', fullName: 'Family Member', email: 'private@example.com',
  relationship: 'Child', status: 'ACTIVE', registrationState: 'STANDARD',
  phone: '+254700000000', location: 'Nairobi',
}

describe('read-only family detail views', () => {
  it('labels the signed-in member as My details', () => {
    const view = familyDetailView({ ...member, isYou: true }, 'Child')
    expect(view.title).toBe('My details')
    expect(view.fields).toContainEqual(['Email', 'private@example.com'])
  })

  it('shows only the four permitted Principal fields to an attached member', () => {
    const view = familyDetailView({ ...member, isPrincipal: true, details: [['Date of birth', 'Private']] }, 'Child')
    expect(view.title).toBe('My Principal Member')
    expect(view.fields).toEqual([
      ['Name', 'Family Member'], ['Location', 'Nairobi'],
      ['Phone', '+254700000000'], ['Your relationship to this Principal', 'Child'],
    ])
    expect(JSON.stringify(view)).not.toContain('private@example.com')
    expect(JSON.stringify(view)).not.toContain('Date of birth')
  })

  it('preserves the full attached-member profile shown to their Principal', () => {
    const view = familyDetailView({ ...member, details: [['Date of birth', '1 Jan 2000'], ['Skills', 'Accounting']] }, null)
    expect(view.title).toBe('Attached member details')
    expect(view.description).toContain('Read-only')
    expect(view.fields).toContainEqual(['Date of birth', '1 Jan 2000'])
    expect(view.fields).toContainEqual(['Skills', 'Accounting'])
  })

  it('labels a Principal opening their own card as My details', () => {
    const view = familyDetailView({ ...member, isYou: true, isPrincipal: true }, null)
    expect(view.title).toBe('My details')
    expect(view.fields).toContainEqual(['Relationship', 'Principal Member'])
  })
})

describe('family member list', () => {
  it('is empty when the only record is the signed-in account', () => {
    expect(familyMemberList([{ ...member, isYou: true }])).toEqual({ principal: undefined, attached: [] })
  })
  it('never presents a Principal as their own attached member', () => {
    const own = { ...member, isYou: true, isPrincipal: true }
    const child = { ...member, id: 'child', isYou: false }
    expect(familyMemberList([own, child])).toEqual({ principal: undefined, attached: [child] })
  })
  it('separates the assigned Principal from other family members and excludes self', () => {
    const own = { ...member, isYou: true }
    const principal = { ...member, id: 'principal', isPrincipal: true }
    const sibling = { ...member, id: 'sibling' }
    expect(familyMemberList([own, principal, sibling])).toEqual({ principal, attached: [sibling] })
  })
})
