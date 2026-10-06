import { ALL_ROLES, allowedDashboards, type Role } from './types'

export const WORKSPACE_COOKIE = 'alubonets-workspace'
export type WorkspaceMode = Role | 'SUPER_ADMIN'
export type WorkspaceAccount = { id: string; role: Role; isSuperAdmin?: boolean; dashboardAccess?: Role[] | null }

export function workspaceCookieValue(accountId: string, role: WorkspaceMode) {
  return `${accountId}:${role}`
}

/** A preference can select an existing permission, never grant a new one. */
export function selectedWorkspaceMode(account: WorkspaceAccount, value?: string): WorkspaceMode {
  const fallback = account.isSuperAdmin ? 'SUPER_ADMIN' : account.role
  const prefix = `${account.id}:`
  if (!value?.startsWith(prefix)) return fallback
  const mode = value.slice(prefix.length) as WorkspaceMode
  if (mode === 'SUPER_ADMIN') return account.isSuperAdmin ? mode : fallback
  return ALL_ROLES.includes(mode) && allowedDashboards(account).includes(mode) ? mode : fallback
}

export function selectedWorkspace(account: WorkspaceAccount, value?: string): Role {
  const mode = selectedWorkspaceMode(account, value)
  return mode === 'SUPER_ADMIN' ? 'ADMIN' : mode
}

export function workspaceProfile<T extends WorkspaceAccount>(account: T, value?: string) {
  const mode = selectedWorkspaceMode(account, value)
  const role = mode === 'SUPER_ADMIN' ? 'ADMIN' : mode
  return {
    ...account,
    role,
    activeWorkspace: role,
    activeSuperAdmin: mode === 'SUPER_ADMIN',
    isSuperAdmin: mode === 'SUPER_ADMIN' && Boolean(account.isSuperAdmin),
    dashboardAccess: [] as Role[],
  }
}
