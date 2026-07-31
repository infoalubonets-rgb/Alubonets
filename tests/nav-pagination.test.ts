import { describe, expect, it } from 'vitest'
import {
  ADMIN_NAV,
  LOANS_NAV_ITEMS,
  MEMBER_NAV,
  withOptionalNav,
  navForRole,
} from '../lib/dashboard/nav'
import {
  buildPageHref,
  parsePage,
  parsePageSize,
  paginationSkip,
  totalPages,
} from '../lib/pagination'

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
