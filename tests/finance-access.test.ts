import { describe, expect, it } from 'vitest'
import { canRecordPayments, canViewAllFinances, canRecordContributions, canRecordContributionFor } from '../lib/finance-access'

describe('contribution account permissions', () => {
  it('allows Treasurer self and other contributions', () => {
    const treasurer = { id: 't', role: 'TREASURER' }
    expect(canRecordContributionFor(treasurer, 't')).toBe(true)
    expect(canRecordContributionFor(treasurer, 'member')).toBe(true)
  })
  it('allows Super Admin for others only', () => {
    const admin = { id: 'a', role: 'ADMIN', isSuperAdmin: true }
    expect(canRecordContributions(admin)).toBe(true)
    expect(canRecordContributionFor(admin, 'a')).toBe(false)
    expect(canRecordContributionFor(admin, 'member')).toBe(true)
    expect(canRecordContributionFor({ ...admin, role: 'TREASURER' }, 'a')).toBe(false)
  })
  it('rejects normal Admin and workspace access alone', () => {
    for (const role of ['ADMIN', 'MEMBER', 'AUDITOR', 'SECRETARY', 'EXECUTIVE', 'ORGANIZER']) {
      const actor = { id: 'a', role, dashboardAccess: ['TREASURER'] }
      expect(canRecordContributions(actor)).toBe(false)
      expect(canRecordContributionFor(actor, 'member')).toBe(false)
    }
  })
})

describe('who sees every member’s contributions', () => {
  it('allows Admin, Super Admin, Treasurer and Auditor', () => {
    expect(canViewAllFinances({ role: 'ADMIN' })).toBe(true)
    expect(canViewAllFinances({ role: 'MEMBER', isSuperAdmin: true })).toBe(true)
    expect(canViewAllFinances({ role: 'TREASURER' })).toBe(true)
    expect(canViewAllFinances({ role: 'AUDITOR' })).toBe(true)
  })

  it('allows anyone given Treasurer access', () => {
    expect(canViewAllFinances({ role: 'SECRETARY', dashboardAccess: ['TREASURER'] })).toBe(true)
  })

  it('keeps everyone else to their own contributions', () => {
    for (const role of ['MEMBER', 'SECRETARY', 'ORGANIZER', 'EXECUTIVE']) {
      expect(canViewAllFinances({ role, dashboardAccess: [] })).toBe(false)
    }
  })
})

describe('who records and reverses payments', () => {
  it('is only the Treasurer', () => {
    expect(canRecordPayments({ role: 'TREASURER' })).toBe(true)
  })

  it('excludes Admin and Super Admin, even with Treasurer access', () => {
    expect(canRecordPayments({ role: 'ADMIN' })).toBe(false)
    expect(canRecordPayments({ role: 'ADMIN', dashboardAccess: ['TREASURER'] })).toBe(false)
    expect(canRecordPayments({ role: 'MEMBER', isSuperAdmin: true, dashboardAccess: ['TREASURER'] })).toBe(false)
  })

  it('allows a member whose second role is Treasurer', () => {
    expect(canRecordPayments({ role: 'SECRETARY', dashboardAccess: ['TREASURER'] })).toBe(true)
  })

  it('excludes the Auditor and every other role', () => {
    for (const role of ['AUDITOR', 'MEMBER', 'SECRETARY', 'ORGANIZER', 'EXECUTIVE']) {
      expect(canRecordPayments({ role })).toBe(false)
    }
  })
})
