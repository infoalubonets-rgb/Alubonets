import { describe, expect, it } from 'vitest'
import { executivePublicExtras } from '../lib/executive-public-profile'
import { sanitizePublicProfileFields } from '../lib/public-profile'
const user = { publicProfileFields: [], email: 'member@example.com', phone: '0700000000', location: 'Nairobi', memberProfile: { profession: 'Teacher' } }
const profile = { biography: 'Member biography', responsibilities: '- Lead meetings\n• Coordinate projects' }
describe('executive public detail permissions', () => {
  it('does not expose extra data when More is disabled', () => {
    expect(executivePublicExtras({ ...user, publicProfileFields: ['email', 'biography', 'responsibilities'] }, profile)).toEqual({ details: [], biography: '', responsibilities: [] })
  })
  it('only exposes individually approved fields', () => {
    expect(executivePublicExtras({ ...user, publicProfileFields: ['more', 'profession', 'biography'] }, profile)).toEqual({ details: ['Teacher'], biography: 'Member biography', responsibilities: [] })
  })
  it('formats approved responsibilities and handles missing profiles', () => {
    expect(executivePublicExtras({ ...user, publicProfileFields: ['more', 'responsibilities'] }, profile).responsibilities).toEqual(['Lead meetings', 'Coordinate projects'])
    expect(executivePublicExtras({ ...user, publicProfileFields: ['more', 'biography'] }, undefined).biography).toBe('')
  })
  it('rejects unsupported personal fields', () => {
    expect(sanitizePublicProfileFields(['more', 'email', 'email', 'password', 'dateOfBirth'])).toEqual(['more', 'email'])
  })
  it('keeps extended profile information private unless individually enabled', () => {
    const extended = { ...user, publicProfileFields: ['more', 'skills'], memberProfile: { profession: 'Teacher', skills: 'Planning', achievements: 'Award', interests: 'Hiking' } }
    expect(executivePublicExtras(extended, profile).details).toEqual(['Planning'])
  })
})
