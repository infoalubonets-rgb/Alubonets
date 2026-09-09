import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import { ALL_ROLES } from '@/lib/auth/types'

export const DISABLED_ROLES_SETTING = 'disabled_roles'

export async function getDisabledRoles(): Promise<Role[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: DISABLED_ROLES_SETTING } })
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value) as string[]
    return parsed.filter((value): value is Role => ALL_ROLES.includes(value as Role) && value !== 'ADMIN')
  } catch {
    return []
  }
}

export async function isRoleActive(role: Role) {
  if (role === 'ADMIN') return true
  const disabled = await getDisabledRoles()
  return !disabled.includes(role)
}

export function assignableRoles(disabled: Role[]) {
  return ALL_ROLES.filter((role) => role === 'ADMIN' || !disabled.includes(role))
}
