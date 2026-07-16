import type { MemberStatus, Role, User } from '@prisma/client'
import type { AuthUser } from './types'

export function initialsFromName(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

export function toAuthUser(user: Pick<User, 'id' | 'email' | 'fullName' | 'role'>): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    initials: initialsFromName(user.fullName),
  }
}

export function isAppRole(value: unknown): value is Role {
  return (
    value === 'ADMIN' ||
    value === 'EXECUTIVE' ||
    value === 'TREASURER' ||
    value === 'SECRETARY' ||
    value === 'ORGANIZER' ||
    value === 'MEMBER'
  )
}

export function isMemberStatus(value: unknown): value is MemberStatus {
  return (
    value === 'PENDING' ||
    value === 'ACTIVE' ||
    value === 'INACTIVE' ||
    value === 'SUSPENDED'
  )
}
