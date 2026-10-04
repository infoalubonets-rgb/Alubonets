export type Role =
  | 'ADMIN'
  | 'EXECUTIVE'
  | 'TREASURER'
  | 'SECRETARY'
  | 'ORGANIZER'
  | 'MEMBER'
  | 'AUDITOR'

export const ALL_ROLES: Role[] = [
  'ADMIN',
  'EXECUTIVE',
  'TREASURER',
  'SECRETARY',
  'ORGANIZER',
  'MEMBER',
  'AUDITOR',
]

export const DASHBOARD_ROLES: Role[] = [
  'ADMIN',
  'EXECUTIVE',
  'TREASURER',
  'SECRETARY',
  'ORGANIZER',
  'MEMBER',
  'AUDITOR',
]

export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: Role
  initials: string
  isSuperAdmin?: boolean
  dashboardAccess?: Role[]
  status?: string
  isPrincipal?: boolean
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
  AUDITOR: '/financial-reports',
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  EXECUTIVE: 'Executive Committee',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  ORGANIZER: 'Organizing Secretary',
  MEMBER: 'Member',
  AUDITOR: 'Auditor (read-only)',
}

/** Primary role + extras; Admin and Super Admin get every dashboard. */
export function allowedDashboards(user: {
  role: Role
  isSuperAdmin?: boolean
  dashboardAccess?: Role[] | null
}): Role[] {
  // Admin and Super Admin are top-level operators with access to every workspace.
  if (user.isSuperAdmin || user.role === 'ADMIN') {
    return [...DASHBOARD_ROLES]
  }
  const extras = user.dashboardAccess ?? []
  return Array.from(new Set<Role>([user.role, ...extras]))
}

export function roleForDashboardPath(pathname: string): Role | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname.startsWith('/admin/login')) return null
    return 'ADMIN'
  }
  if (pathname.startsWith('/dashboard/executive')) return 'EXECUTIVE'
  if (pathname.startsWith('/dashboard/treasurer')) return 'TREASURER'
  if (pathname.startsWith('/dashboard/secretary')) return 'SECRETARY'
  if (pathname.startsWith('/dashboard/organizer')) return 'ORGANIZER'
  if (pathname.startsWith('/dashboard/member')) return 'MEMBER'
  return null
}

/** Paths every authenticated ACTIVE user may open; page-level auth still enforces role. */
export function isSharedAuthenticatedPath(pathname: string): boolean {
  const roots = [
    '/profile',
    '/contributions',
    '/announcements',
    '/governance',
    '/documents',
    '/financial-reports',
    '/family',
    '/directory',
    '/today',
  ]
  if (pathname === '/dashboard/member/family' || pathname.startsWith('/dashboard/member/family/')) {
    return true
  }
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}
