import { describe, expect, it } from 'vitest'
import {
  ADMIN_NAV,
  EXECUTIVE_NAV,
  LOANS_NAV_ITEMS,
  MEMBER_NAV,
  ORGANIZER_NAV,
  SECRETARY_NAV,
  TREASURER_NAV,
  withOptionalNav,
  navForRole,
} from '../lib/dashboard/nav'
import { isSharedAuthenticatedPath } from '../lib/auth/types'
import {
  buildPageHref,
  parsePage,
  parsePageSize,
  paginationSkip,
  totalPages,
} from '../lib/pagination'
import { existsSync } from 'node:fs'
import path from 'node:path'

describe('withOptionalNav', () => {
  it('returns nav unchanged when item is null', () => {
    expect(withOptionalNav(MEMBER_NAV, null)).toEqual(MEMBER_NAV)
  })

  it('inserts loans after contributions href', () => {
    const nav = withOptionalNav(ADMIN_NAV, LOANS_NAV_ITEMS.admin, '/admin/finance')
    const financeIdx = nav.findIndex((n) => n.href === '/admin/finance')
    expect(nav[financeIdx + 1]?.href).toBe('/admin/loans')
  })
})

describe('navForRole', () => {
  it('returns role-specific nav', () => {
    expect(navForRole('TREASURER')[0]?.href).toBe('/dashboard/treasurer')
    expect(navForRole('MEMBER').some((n) => n.href === '/dashboard/member')).toBe(true)
  })
})

describe('pagination helpers', () => {
  it('parses page and size with clamps', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('3')).toBe(3)
    expect(parsePageSize('500')).toBe(100)
    expect(paginationSkip(2, 25)).toBe(25)
    expect(totalPages(0, 25)).toBe(1)
    expect(totalPages(26, 25)).toBe(2)
  })

  it('builds page hrefs', () => {
    expect(buildPageHref('/admin/members', { q: 'ann' }, 2)).toBe('/admin/members?q=ann&page=2')
  })
})

describe('isSharedAuthenticatedPath', () => {
  it('allows governance, documents, reports and profile portals', () => {
    expect(isSharedAuthenticatedPath('/governance')).toBe(true)
    expect(isSharedAuthenticatedPath('/governance/manage')).toBe(true)
    expect(isSharedAuthenticatedPath('/documents')).toBe(true)
    expect(isSharedAuthenticatedPath('/documents/manage')).toBe(true)
    expect(isSharedAuthenticatedPath('/financial-reports')).toBe(true)
    expect(isSharedAuthenticatedPath('/profile')).toBe(true)
    expect(isSharedAuthenticatedPath('/contributions')).toBe(true)
    expect(isSharedAuthenticatedPath('/announcements')).toBe(true)
    expect(isSharedAuthenticatedPath('/dashboard/member')).toBe(false)
    expect(isSharedAuthenticatedPath('/admin')).toBe(false)
  })
})

describe('dashboard nav hrefs resolve to page files', () => {
  const root = path.join(process.cwd())

  function pageFileForHref(href: string): string[] {
    const clean = href.split('?')[0].replace(/\/$/, '') || '/'
    if (clean === '/') {
      return [
        path.join(root, 'app', 'page.tsx'),
        path.join(root, 'app', '(public)', 'page.tsx'),
      ]
    }
    const rel = clean.replace(/^\//, '')
    return [
      path.join(root, 'app', rel, 'page.tsx'),
      path.join(root, 'app', '(public)', rel, 'page.tsx'),
    ]
  }

  const hrefs = [
    ...ADMIN_NAV,
    ...EXECUTIVE_NAV,
    ...TREASURER_NAV,
    ...SECRETARY_NAV,
    ...ORGANIZER_NAV,
    ...MEMBER_NAV,
    LOANS_NAV_ITEMS.member,
    LOANS_NAV_ITEMS.treasurer,
    LOANS_NAV_ITEMS.admin,
    LOANS_NAV_ITEMS.executive,
  ]
    .map((n) => n.href)
    .filter((h) => h && h !== '#')

  const publicAuth = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/privacy',
    '/terms',
    '/about',
    '/events',
    '/projects',
    '/gallery',
    '/contact',
  ]

  it.each([...new Set([...hrefs, ...publicAuth])])('%s has a page.tsx', (href) => {
    const candidates = pageFileForHref(href)
    expect(candidates.some((file) => existsSync(file))).toBe(true)
  })
})
