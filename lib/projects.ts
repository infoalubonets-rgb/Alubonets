import type { Role } from '@prisma/client'

export function isProjectManager(role: Role) {
  return role === 'ADMIN' || role === 'EXECUTIVE' || role === 'ORGANIZER'
}

export function canModerateProjectComments(role: Role) {
  return role === 'ADMIN' || role === 'EXECUTIVE'
}

export function canSeeFullProjectFinance(role: Role) {
  return isProjectManager(role)
}

export function canSeeFundingSummary(role: Role | null | undefined) {
  return Boolean(role)
}

export type ProjectFinanceVisibility = 'public' | 'member' | 'manager'

export function projectFinanceVisibility(role: Role | null | undefined): ProjectFinanceVisibility {
  if (!role) return 'public'
  if (canSeeFullProjectFinance(role)) return 'manager'
  return 'member'
}

export function moneyNumber(value: unknown) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value)
}
