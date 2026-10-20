import { describe, expect, it } from 'vitest'
import { homeForAccount } from '@/lib/auth/types'
describe('account landing page', () => {
  it('sends a super admin to admin even when their primary role is member', () => {
    expect(homeForAccount({ role: 'MEMBER', isSuperAdmin: true })).toBe('/admin')
  })
  it('sends administrators to admin', () => {
    expect(homeForAccount({ role: 'ADMIN' })).toBe('/admin')
  })
  it('sends members to the member dashboard', () => {
    expect(homeForAccount({ role: 'MEMBER' })).toBe('/dashboard/member')
  })
  it('keeps other staff in their own dashboard', () => {
    expect(homeForAccount({ role: 'TREASURER' })).toBe('/dashboard/treasurer')
  })
})
