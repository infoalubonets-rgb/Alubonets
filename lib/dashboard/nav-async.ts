import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags'
import {
  ADMIN_NAV,
  EXECUTIVE_NAV,
  MEMBER_NAV,
  TREASURER_NAV,
  LOANS_NAV_ITEMS,
  withOptionalNav,
  navForRole,
  type NavItem,
} from '@/lib/dashboard/nav'
import type { Role } from '@/lib/auth/types'

export async function navWithLoans(role: Role): Promise<NavItem[]> {
  const loansOn = await isFeatureEnabled(FEATURE_FLAGS.loansEnabled)
  const base = navForRole(role)
  if (!loansOn) return base
  switch (role) {
    case 'ADMIN':
      return withOptionalNav(ADMIN_NAV, LOANS_NAV_ITEMS.admin, '/admin/finance')
    case 'TREASURER':
      return withOptionalNav(TREASURER_NAV, LOANS_NAV_ITEMS.treasurer, '/dashboard/treasurer/welfare')
    case 'EXECUTIVE':
      return withOptionalNav(EXECUTIVE_NAV, LOANS_NAV_ITEMS.executive, '/financial-reports')
    case 'MEMBER':
    case 'SECRETARY':
    case 'ORGANIZER':
      return withOptionalNav(base, LOANS_NAV_ITEMS.member, '/contributions')
    default:
      return withOptionalNav(MEMBER_NAV, LOANS_NAV_ITEMS.member, '/contributions')
  }
}
