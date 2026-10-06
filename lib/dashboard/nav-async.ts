import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags'
import {
  ADMIN_NAV,
  MEMBER_NAV,
  LOANS_NAV_ITEMS,
  WELFARE_NAV_ITEMS,
  withOptionalNav,
  navForRole,
  type NavItem,
} from '@/lib/dashboard/nav'
import type { Role } from '@/lib/auth/types'

export async function navWithLoans(role: Role): Promise<NavItem[]> {
  const [loansOn, welfareOn] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.loansEnabled),
    isFeatureEnabled(FEATURE_FLAGS.welfareEnabled),
  ])
  let base = navForRole(role)
  if (welfareOn) {
    switch (role) {
      case 'ADMIN':
        break
      case 'TREASURER':
        base = withOptionalNav(base, WELFARE_NAV_ITEMS.treasurer, '/financial-reports')
        break
      case 'EXECUTIVE':
        base = withOptionalNav(base, WELFARE_NAV_ITEMS.executive, '/financial-reports')
        break
      case 'MEMBER':
      case 'SECRETARY':
      case 'ORGANIZER':
        base = withOptionalNav(base, WELFARE_NAV_ITEMS.member, '/contributions')
        break
      default:
        base = withOptionalNav(base, WELFARE_NAV_ITEMS.member, '/contributions')
    }
  }
  if (!loansOn) return base
  switch (role) {
    case 'ADMIN':
      return withOptionalNav(ADMIN_NAV, LOANS_NAV_ITEMS.admin, '/admin/finance')
    case 'TREASURER':
      return withOptionalNav(base, LOANS_NAV_ITEMS.treasurer, '/financial-reports')
    case 'EXECUTIVE':
      return withOptionalNav(base, LOANS_NAV_ITEMS.executive, '/financial-reports')
    case 'MEMBER':
    case 'SECRETARY':
    case 'ORGANIZER':
      return withOptionalNav(base, LOANS_NAV_ITEMS.member, '/contributions')
    default:
      return withOptionalNav(MEMBER_NAV, LOANS_NAV_ITEMS.member, '/contributions')
  }
}
