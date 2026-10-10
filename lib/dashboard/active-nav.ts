import type { NavItem } from './nav'
import { navForRole } from './nav'
import { roleForDashboardPath } from '@/lib/auth/types'

const overviewPath = (path: string) => path === '/admin' || /^\/dashboard\/(member|treasurer|executive|secretary|organizer)$/.test(path)
const matches = (path: string, href?: string) => Boolean(href && href !== '#' &&
  (path === href || (!overviewPath(href) && path.startsWith(`${href}/`))))

function directGroup(path: string, nav: NavItem[]): NavItem | undefined {
  return nav.reduce<{ item: NavItem; score: number } | undefined>((best, item) => {
    const score = [item, ...(item.children ?? [])].reduce((length, candidate) =>
      matches(path, candidate.href) ? Math.max(length, candidate.href!.length) : length, 0)
    return score > (best?.score ?? 0) ? { item, score } : best
  }, undefined)?.item
}

/** Match the viewed page even when its route belongs to another permitted workspace. */
export function activeNavGroup(pathname: string, nav: NavItem[]): NavItem | undefined {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  const direct = directGroup(path, nav)
  if (direct) return direct
  if (overviewPath(path)) return nav.find(item => item.label === 'Overview')
  const pageRole = roleForDashboardPath(path)
  const pageGroup = pageRole ? directGroup(path, navForRole(pageRole)) : undefined
  return pageGroup ? nav.find(item => item.label === pageGroup.label) : undefined
}
