import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from '@/lib/safe-redirect'

describe('safeRedirectPath', () => {
  it('keeps paths on this site, with query and hash', () => {
    expect(safeRedirectPath('/dashboard/member')).toBe('/dashboard/member')
    expect(safeRedirectPath('/events/abc?tab=rsvp#top')).toBe('/events/abc?tab=rsvp#top')
  })
  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '\\\\evil.com',
    '/ /evil.com',
    '/\tevil.com',
    'javascript:alert(1)',
    'evil.com',
    '',
    null,
    undefined,
  ])('rejects %j', (value) => {
    expect(safeRedirectPath(value)).toBeNull()
  })
})
