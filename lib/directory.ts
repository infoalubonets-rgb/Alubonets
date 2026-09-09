export const DIRECTORY_SAFE_FIELDS = [
  'fullName',
  'role',
  'familyBranch',
  'profession',
  'skills',
  'location',
] as const

export type DirectorySafeField = (typeof DIRECTORY_SAFE_FIELDS)[number]

/**
 * Roles allowed to see every active member regardless of individual visibility settings.
 * Admin and Super Admin always qualify; extra roles are opt-in from Admin → Settings.
 */
export const DIRECTORY_FULL_ACCESS_SETTING = 'directory_full_access_roles'

export type DirectoryMember = {
  id: string
  fullName: string
  relationship: string | null
  principalName: string | null
  isPrincipal: boolean
  role: string | null
  familyBranch: string | null
  profession: string | null
  skills: string | null
  location: string | null
}
