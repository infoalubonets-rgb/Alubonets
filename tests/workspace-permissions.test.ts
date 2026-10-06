import { describe, expect, it } from 'vitest'
import { selectedWorkspace, workspaceCookieValue, workspaceProfile } from '../lib/auth/workspace'

const admin = { id: 'admin-account', role: 'ADMIN' as const, isSuperAdmin: true, dashboardAccess: ['ADMIN', 'TREASURER', 'MEMBER'] as const }
const account = { ...admin, dashboardAccess: [...admin.dashboardAccess] }

describe('workspace permission isolation', () => {
  it('removes Admin and Super Admin authority in Member mode', () => {
    const effective = workspaceProfile(account, workspaceCookieValue(account.id, 'MEMBER'))
    expect(effective.role).toBe('MEMBER')
    expect(effective.isSuperAdmin).toBe(false)
    expect(effective.dashboardAccess).toEqual([])
    expect(effective.id).toBe(account.id)
  })
  it.each(['EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'AUDITOR'] as const)('uses only %s permissions when selected', role => {
    const effective = workspaceProfile(account, workspaceCookieValue(account.id, role))
    expect(effective.role).toBe(role)
    expect(effective.isSuperAdmin).toBe(false)
    expect(effective.dashboardAccess).toEqual([])
  })
  it('restores permitted Admin authority only when Admin is selected', () => {
    expect(workspaceProfile(account, workspaceCookieValue(account.id, 'SUPER_ADMIN')).isSuperAdmin).toBe(true)
  })
  it('removes Super Admin authority in Administrator mode', () => {
    const effective = workspaceProfile(account, workspaceCookieValue(account.id, 'ADMIN'))
    expect(effective.role).toBe('ADMIN')
    expect(effective.isSuperAdmin).toBe(false)
  })
  it('cannot grant an ordinary member Admin through a modified cookie', () => {
    const member = { id: 'member', role: 'MEMBER' as const }
    expect(selectedWorkspace(member, workspaceCookieValue(member.id, 'ADMIN'))).toBe('MEMBER')
  })
  it('accepts assigned second roles without inheriting permissions from them', () => {
    const member = { id: 'member', role: 'MEMBER' as const, dashboardAccess: ['SECRETARY' as const] }
    expect(workspaceProfile(member).dashboardAccess).toEqual([])
    expect(workspaceProfile(member, workspaceCookieValue(member.id, 'SECRETARY')).role).toBe('SECRETARY')
  })
  it('ignores another account’s workspace preference', () => {
    const member = { id: 'member', role: 'MEMBER' as const }
    expect(selectedWorkspace(member, workspaceCookieValue(account.id, 'ADMIN'))).toBe('MEMBER')
  })
})
