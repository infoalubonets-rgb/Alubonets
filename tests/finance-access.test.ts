import { describe, expect, it } from 'vitest'
import { canRecordPayments, canViewAllFinances } from '../lib/finance-access'

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
