export const DIRECTORY_SAFE_FIELDS = [
  'fullName',
  'role',
  'profession',
  'skills',
  'location',
] as const

export type DirectorySafeField = (typeof DIRECTORY_SAFE_FIELDS)[number]

/** Executive is a role someone can hold as their main role or alongside another (e.g. Secretary + Executive). */
export function isExecutive(user: { role: string; dashboardAccess?: readonly string[] | null }) {
  return user.role === 'EXECUTIVE' || (user.dashboardAccess ?? []).includes('EXECUTIVE')
}

/**
 * Admin, Super Admin, Auditor and executives open the Members page with full details. Other roles
 * see members only where their work needs it — contributions (Treasurer), minutes attendance
 * (Secretary), communications recipients (Organizing Secretary) — limited to name, email and phone.
 */
export function canViewMemberDirectory(user: { role: string; isSuperAdmin?: boolean | null; dashboardAccess?: readonly string[] | null }) {
  return user.role === 'ADMIN' || user.role === 'AUDITOR' || Boolean(user.isSuperAdmin) || isExecutive(user)
}

export type DirectoryMember = {
  id: string
  fullName: string
  relationship: string | null
  principalName: string | null
  isPrincipal: boolean
  /** PJW for a Principal, PJW01 for an attached member, null when not in a family. */
  familyTag: string | null
  /** The family's code (PJW) for both the Principal and attached members, for search. */
  familyCode: string | null
  role: string | null
  profession: string | null
  skills: string | null
  location: string | null
  isSuperAdmin: boolean
  /** Executive as their main role or as a second role. */
  isExecutive: boolean
  /** Under 18, or a child/dependant with no date of birth on file. */
  isMinor: boolean
  /** Extra profile details — only for viewers with full directory access. */
  details: {
    membershipNumber: string | null
    standing: string
    joinedAt: string
    age: number | null
    gender: string | null
    familyBranch: string | null
    memberCategory: string | null
    educationLevel: string | null
    interests: string | null
    mentorshipArea: string | null
    attachedCount: number
  } | null
  /** Contact details — everyone allowed on the Members page. */
  contact: { email: string; phone: string | null } | null
  /** Account management fields — Admin and Super Admin only. */
  account: {
    status: string
    standingReason: string | null
    standingOverride: string | null
    standingOverrideUntil: string | null
    contributionExempt: boolean
    about: { show: boolean; title: string | null; order: number; fields: string[] }
  } | null
}
