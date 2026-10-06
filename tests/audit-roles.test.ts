import { describe, expect, it } from 'vitest'
import { actingRoleFor, auditActorRole, isOutsidePrimaryRole } from '../lib/audit-roles'

describe('audit entries flagged as outside the primary role', () => {
  it('flags a Secretary recording a payment through Treasurer access', () => {
    expect(isOutsidePrimaryRole('LEDGER_CONTRIBUTION_CREATE', 'SECRETARY')).toBe(true)
  })

  it('does not flag the Treasurer doing Treasurer work', () => {
    expect(isOutsidePrimaryRole('LEDGER_CONTRIBUTION_CREATE', 'TREASURER')).toBe(false)
    expect(isOutsidePrimaryRole('REVERSAL_APPROVE', 'TREASURER')).toBe(false)
  })

  it('does not flag an Admin approving a reversal, but flags an Executive doing it', () => {
    expect(isOutsidePrimaryRole('REVERSAL_APPROVE', 'ADMIN')).toBe(false)
    expect(isOutsidePrimaryRole('REVERSAL_APPROVE', 'EXECUTIVE')).toBe(true)
  })

  it('flags a Treasurer publishing meeting minutes', () => {
    expect(isOutsidePrimaryRole('MEETING_PUBLISH', 'TREASURER')).toBe(true)
  })

  it('never flags actions anyone may do, or entries with no known actor', () => {
    expect(isOutsidePrimaryRole('PROFILE_UPDATE', 'MEMBER')).toBe(false)
    expect(isOutsidePrimaryRole('EVENT_RSVP', 'TREASURER')).toBe(false)
    expect(isOutsidePrimaryRole('LEDGER_CONTRIBUTION_CREATE', null)).toBe(false)
  })

  it('records a Super Admin as Admin', () => {
    expect(auditActorRole({ role: 'MEMBER', isSuperAdmin: true })).toBe('ADMIN')
    expect(auditActorRole({ role: 'SECRETARY' })).toBe('SECRETARY')
  })
})

describe('role a change was made as', () => {
  it('is the primary role when that covers the action', () => {
    expect(actingRoleFor('LEDGER_CONTRIBUTION_CREATE', 'TREASURER', ['SECRETARY'])).toBe('TREASURER')
  })

  it('is the secondary role that allowed it otherwise', () => {
    expect(actingRoleFor('LEDGER_CONTRIBUTION_CREATE', 'SECRETARY', ['EXECUTIVE', 'TREASURER'])).toBe('TREASURER')
  })

  it('is empty when no role the person holds covers it', () => {
    expect(actingRoleFor('LEDGER_CONTRIBUTION_CREATE', 'SECRETARY', ['EXECUTIVE'])).toBeNull()
  })

  it('is the primary role for actions anyone may do', () => {
    expect(actingRoleFor('PROFILE_UPDATE', 'MEMBER', [])).toBe('MEMBER')
  })
})
