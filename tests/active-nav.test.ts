import { describe, expect, it } from 'vitest'
import { activeNavGroup } from '@/lib/dashboard/active-nav'
import { ADMIN_NAV, MEMBER_NAV } from '@/lib/dashboard/nav'

describe('current sidebar section', () => {
  it('highlights Overview on a member overview with Admin navigation', () => {
    expect(activeNavGroup('/dashboard/member', ADMIN_NAV)?.label).toBe('Overview')
  })
  it('highlights the same section for a different workspace route', () => {
    expect(activeNavGroup('/dashboard/member/family', ADMIN_NAV)?.label).toBe('My Family')
    expect(activeNavGroup('/dashboard/member/projects/project-id', ADMIN_NAV)?.label).toBe('Projects & events')
  })
  it('highlights the parent for related pages and nested detail routes', () => {
    expect(activeNavGroup('/contributions', ADMIN_NAV)?.label).toBe('Finance')
    expect(activeNavGroup('/admin/roles', ADMIN_NAV)?.label).toBe('Settings')
    expect(activeNavGroup('/dashboard/member/events/event-id', MEMBER_NAV)?.label).toBe('Projects & events')
  })
  it('does not incorrectly highlight Overview for an unmatched admin page', () => {
    expect(activeNavGroup('/admin/unmatched', ADMIN_NAV)).toBeUndefined()
  })
})
