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
  type NavItem,
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

  it('inserts loans after finance href', () => {
    const nav = withOptionalNav(ADMIN_NAV, LOANS_NAV_ITEMS.admin, '/admin/finance')
    const financeIdx = nav.findIndex((n) => n.href === '/admin/finance')
    expect(nav[financeIdx + 1]?.href).toBe('/admin/loans')
  })

  it('keeps the admin sidebar to 15 top-level sections', () => {
    // 11 originally, plus Directory, Today/Activities, My Family and My contributions.
    expect(ADMIN_NAV).toHaveLength(15)
  })

  it('keeps every former admin destination in a main section or related page', () => {
    const adminHrefs = ADMIN_NAV.flatMap((item) => [
      item.href,
      ...(item.children?.map((child) => child.href) || []),
    ])
    expect(adminHrefs).toEqual(expect.arrayContaining([
      '/admin',
      '/admin/members',
      '/meetings-reports',
      '/admin/approvals',
      '/admin/gallery-queue',
      '/admin/finance',
      '/dashboard/executive/projects',
      '/dashboard/member/events',
      '/documents/manage',
      '/documents',
      '/governance/manage',
      // '/admin/content' was removed in 04ec719 — the page no longer exists.
      '/admin/roles',
      '/admin/announcements',
      '/admin/settings',
      '/admin/audit-logs',
      '/dashboard/member/family',
      '/contributions',
    ]))
  })
})

describe('navForRole', () => {
  it('returns role-specific nav', () => {
    expect(navForRole('TREASURER')[0]?.href).toBe('/dashboard/treasurer')
    expect(navForRole('MEMBER').some((n) => n.href === '/dashboard/member')).toBe(true)
    // Members reach the read/vote governance page, but never the manage console.
    expect(navForRole('MEMBER').some((n) => n.href === '/governance')).toBe(true)
    expect(navForRole('MEMBER').some((n) => n.href === '/governance/manage')).toBe(false)
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

  const navItems: NavItem[] = [
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
  const hrefs = navItems
    .flatMap((n) => [n.href, ...(n.children?.map((child) => child.href) || [])])
    .filter((h): h is string => Boolean(h && h !== '#'))

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
