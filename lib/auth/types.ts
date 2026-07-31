export type Role =
  | 'ADMIN'
  | 'EXECUTIVE'
  | 'TREASURER'
  | 'SECRETARY'
  | 'ORGANIZER'
  | 'MEMBER'

export const ALL_ROLES: Role[] = [
  'ADMIN',
  'EXECUTIVE',
  'TREASURER',
  'SECRETARY',
  'ORGANIZER',
  'MEMBER',
]

export const DASHBOARD_ROLES: Role[] = [
  'ADMIN',
  'EXECUTIVE',
  'TREASURER',
  'SECRETARY',
  'ORGANIZER',
  'MEMBER',
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

/** Primary role + extras; Super Admin gets every dashboard. */
export function allowedDashboards(user: {
  role: Role
  isSuperAdmin?: boolean
  dashboardAccess?: Role[] | null
}): Role[] {
  if (user.isSuperAdmin || user.role === 'ADMIN') {
    // Super Admin: all. Regular Admin: admin home + any granted extras (still can open admin).
    if (user.isSuperAdmin) return [...DASHBOARD_ROLES]
    const extras = user.dashboardAccess ?? []
    return Array.from(new Set<Role>(['ADMIN', ...extras]))
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
  ]
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}
