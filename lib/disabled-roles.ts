import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import { ALL_ROLES, ROLE_LABEL } from '@/lib/auth/types'

export const DISABLED_ROLES_SETTING = 'disabled_roles'
export const DISABLED_ROLES_TAG = 'disabled-roles'

export function parseDisabledRoles(raw: string | null | undefined): Role[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as string[]
    return parsed.filter((value): value is Role => ALL_ROLES.includes(value as Role) && value !== 'ADMIN')
  } catch {
    return []
  }
}

// Read on every protected page load, so keep it in the data cache; toggles revalidate the tag.
const getCachedDisabledRoles = unstable_cache(
  async () => {
    const row = await prisma.appSetting.findUnique({ where: { key: DISABLED_ROLES_SETTING } })
    return parseDisabledRoles(row?.value)
  },
  [DISABLED_ROLES_SETTING],
  { revalidate: 300, tags: [DISABLED_ROLES_TAG] },
)

export async function getDisabledRoles(): Promise<Role[]> {
  return getCachedDisabledRoles()
}

export async function isRoleActive(role: Role) {
  if (role === 'ADMIN') return true
  const disabled = await getDisabledRoles()
  return !disabled.includes(role)
}

export function assignableRoles(disabled: Role[]) {
  return ALL_ROLES.filter((role) => role === 'ADMIN' || !disabled.includes(role))
}

/** Administrators and the Super Admin can never be locked out by the role catalogue. */
export function isLockedOutByRole(user: { role: Role; isSuperAdmin?: boolean | null }, disabled: Role[]) {
  if (user.role === 'ADMIN' || user.isSuperAdmin) return false
  return disabled.includes(user.role)
}

export function roleInactiveMessage(role?: Role) {
  const label = role ? ROLE_LABEL[role] : 'assigned'
  return `Your ${label} role is currently inactive, so you cannot sign in. Please contact the administrator.`
}
