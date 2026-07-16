export type Role =
  | 'ADMIN'
  | 'EXECUTIVE'
  | 'TREASURER'
  | 'SECRETARY'
  | 'ORGANIZER'
  | 'MEMBER'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: Role
  initials: string
}

export type JwtPayload = {
  sub: string
  email: string
  fullName: string
  role: Role
}

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  EXECUTIVE: '/dashboard/executive',
  TREASURER: '/dashboard/treasurer',
  SECRETARY: '/dashboard/secretary',
  ORGANIZER: '/dashboard/organizer',
  MEMBER: '/dashboard/member',
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  EXECUTIVE: 'Executive Committee',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  ORGANIZER: 'Organizer',
  MEMBER: 'Member',
}
