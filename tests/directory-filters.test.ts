import { describe, expect, it } from 'vitest'
import { matchesDirectoryFilters, memberType } from '../lib/directory-filters'

const person = (overrides: Partial<Parameters<typeof matchesDirectoryFilters>[0]> = {}) => ({
  isPrincipal: false,
  isMinor: false,
  principalName: null,
  relationship: null,
  role: 'MEMBER',
  isSuperAdmin: false,
  account: { status: 'ACTIVE' } as Parameters<typeof matchesDirectoryFilters>[0]['account'],
  ...overrides,
})

const none = { type: '', role: '', status: '' }

const principal = person({ isPrincipal: true })
const spouse = person({ principalName: 'Otieno', relationship: 'SPOUSE' })
const child = person({ principalName: 'Otieno', relationship: 'CHILD', isMinor: true })
const treasurer = person({ role: 'TREASURER', isPrincipal: true })
const organizer = person({ role: 'ORGANIZER', principalName: 'Otieno', relationship: 'OTHER' })
const superAdmin = person({ role: 'ADMIN', isSuperAdmin: true })
const admin = person({ role: 'ADMIN' })
const pending = person({ account: { status: 'PENDING' } as never })
const suspendedTreasurer = person({ role: 'TREASURER', account: { status: 'SUSPENDED' } as never })
const everyone = [principal, spouse, child, treasurer, organizer, superAdmin, admin, pending, suspendedTreasurer]

const matching = (filters: Partial<typeof none>) =>
  everyone.filter((member) => matchesDirectoryFilters(member, { ...none, ...filters }))

describe('member type', () => {
  it('classifies principals, attached members and minors', () => {
    expect(memberType(principal)).toBe('Principal')
    expect(memberType(spouse)).toBe('Attached')
    expect(memberType(child)).toBe('Minor')
    expect(memberType(admin)).toBe('Member')
  })
})

describe('Members page filters', () => {
  it('shows everyone with no filter set', () => {
    expect(matching({})).toHaveLength(everyone.length)
  })

  it('filters by member type', () => {
    expect(matching({ type: 'Principal' })).toEqual([principal, treasurer])
    expect(matching({ type: 'Attached' })).toEqual([spouse, organizer])
    expect(matching({ type: 'Minor' })).toEqual([child])
  })

  it('filters by role, with Super Administrator separate', () => {
    expect(matching({ role: 'TREASURER' })).toEqual([treasurer, suspendedTreasurer])
    expect(matching({ role: 'ORGANIZER' })).toEqual([organizer])
    expect(matching({ role: 'SUPER_ADMIN' })).toEqual([superAdmin])
  })

  it('filters by account status', () => {
    expect(matching({ status: 'PENDING' })).toEqual([pending])
    expect(matching({ status: 'SUSPENDED' })).toEqual([suspendedTreasurer])
  })

  it('combines filters — every one set must match', () => {
    expect(matching({ role: 'TREASURER', status: 'ACTIVE' })).toEqual([treasurer])
    expect(matching({ role: 'TREASURER', type: 'Principal' })).toEqual([treasurer])
    expect(matching({ role: 'ORGANIZER', type: 'Principal' })).toEqual([])
    expect(matching({ role: 'SUPER_ADMIN', status: 'SUSPENDED' })).toEqual([])
  })

  it('never matches a status filter for viewers without account details', () => {
    expect(matchesDirectoryFilters(person({ account: null }), { ...none, status: 'ACTIVE' })).toBe(false)
  })
})
