import { describe, expect, it } from 'vitest'
import { familyInviteStatus } from '../lib/family-invite'

describe('family invitation lifecycle', () => {
  const now = new Date('2026-08-13T12:00:00Z')
  it('recognizes a pending invitation', () => expect(familyInviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-08-14') }, now)).toBe('PENDING'))
  it('recognizes expiry', () => expect(familyInviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-08-13') }, now)).toBe('EXPIRED'))
  it('recognizes explicit revocation before expiry', () => expect(familyInviteStatus({ acceptedAt: null, revokedAt: now, expiresAt: new Date('2026-08-14') }, now)).toBe('REVOKED'))
  it('keeps accepted invitations accepted', () => expect(familyInviteStatus({ acceptedAt: now, revokedAt: null, expiresAt: new Date('2026-08-13') }, now)).toBe('ACCEPTED'))
})
