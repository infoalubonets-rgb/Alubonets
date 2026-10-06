import type { DirectoryMember } from '@/lib/directory'

export type MemberType = 'Principal' | 'Attached' | 'Minor' | 'Member'

type Classifiable = Pick<DirectoryMember, 'isPrincipal' | 'isMinor' | 'principalName' | 'relationship'>

/** A principal is never a minor here; anyone else with a principal or a relationship is attached. */
export function memberType(member: Classifiable): MemberType {
  if (member.isPrincipal) return 'Principal'
  if (member.isMinor) return 'Minor'
  if (member.principalName || member.relationship) return 'Attached'
  return 'Member'
}

export type DirectoryFilterValues = { type: string; role: string; status: string }

/** The Members-page dropdowns combine: a member must match every filter that is set. */
export function matchesDirectoryFilters(
  member: Classifiable & Pick<DirectoryMember, 'role' | 'isSuperAdmin' | 'account'> & { isExecutive?: boolean },
  filters: DirectoryFilterValues,
) {
  if (filters.type && memberType(member) !== filters.type) return false
  if (filters.status && member.account?.status !== filters.status) return false
  if (filters.role === 'SUPER_ADMIN') return member.isSuperAdmin
  // Executives include people who hold it as a second role (e.g. Secretary + Executive).
  if (filters.role === 'EXECUTIVE') return member.role === 'EXECUTIVE' || Boolean(member.isExecutive)
  if (filters.role && member.role !== filters.role) return false
  return true
}
