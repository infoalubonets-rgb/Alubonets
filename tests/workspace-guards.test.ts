import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKSPACE_COOKIE, workspaceCookieValue } from '../lib/auth/workspace'

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(), setCookie: vi.fn(), getUser: vi.fn(), redirect: vi.fn(), isRoleActive: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.getCookie, set: mocks.setCookie }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/utils/supabase/server', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/supabase-server', () => ({ createServerClient: vi.fn() }))
vi.mock('@/lib/disabled-roles', () => ({
  getDisabledRoles: async () => [], isLockedOutByRole: () => false, isRoleActive: mocks.isRoleActive,
}))

import { requireAdmin, requireActiveRole, getSessionUser } from '@/lib/auth/session'
import { switchWorkspace } from '@/app/actions/workspace'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: {
    id: 'auth-admin', email: 'admin@example.com', app_metadata: {
      dbUserId: 'admin', fullName: 'Administrator', role: 'ADMIN', status: 'ACTIVE',
      isSuperAdmin: true, dashboardAccess: ['ADMIN', 'TREASURER'], principalMemberId: null,
    },
  } }, error: null })
  mocks.getCookie.mockImplementation(name => name === WORKSPACE_COOKIE ? { value: workspaceCookieValue('admin', 'MEMBER') } : undefined)
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`) })
  mocks.isRoleActive.mockResolvedValue(true)
})

describe('server permissions after selecting a workspace', () => {
  it('blocks Admin actions for a Super Admin who selected Member', async () => {
    await expect(requireAdmin()).rejects.toThrow('redirect:/dashboard/member')
  })
  it('blocks staff actions in Member mode', async () => {
    await expect(requireActiveRole(['SECRETARY', 'TREASURER'])).rejects.toThrow('redirect:/dashboard/member')
  })
  it('still provides the real role list for switching back, without using it for authorization', async () => {
    const user = await getSessionUser()
    expect(user?.role).toBe('ADMIN')
    expect(user?.activeWorkspace).toBe('MEMBER')
    expect(user?.isSuperAdmin).toBe(true)
  })
  it('lets an authorized account explicitly switch back to Admin', async () => {
    await switchWorkspace('ADMIN')
    expect(mocks.setCookie).toHaveBeenCalledWith(WORKSPACE_COOKIE, workspaceCookieValue('admin', 'ADMIN'), expect.objectContaining({ httpOnly: true, path: '/' }))
  })
  it('rejects attempts to switch to an unassigned role', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-member', email: 'member@example.com', app_metadata: {
      dbUserId: 'member', fullName: 'Member', role: 'MEMBER', status: 'ACTIVE', principalMemberId: null,
    } } }, error: null })
    await expect(switchWorkspace('ADMIN')).rejects.toThrow('You do not have access')
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })
  it('lets an Admin or Super Admin open a deactivated workspace', async () => {
    mocks.isRoleActive.mockResolvedValue(false)
    await switchWorkspace('AUDITOR')
    expect(mocks.setCookie).toHaveBeenCalledWith(WORKSPACE_COOKIE, workspaceCookieValue('admin', 'AUDITOR'), expect.objectContaining({ httpOnly: true }))
  })
  it('does not let other accounts enter a deactivated workspace', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-treasurer', email: 'treasurer@example.com', app_metadata: {
      dbUserId: 'treasurer', fullName: 'Treasurer', role: 'TREASURER', status: 'ACTIVE',
      dashboardAccess: ['TREASURER', 'SECRETARY'], principalMemberId: null,
    } } }, error: null })
    mocks.isRoleActive.mockResolvedValue(false)
    await expect(switchWorkspace('SECRETARY')).rejects.toThrow('deactivated')
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })
})
