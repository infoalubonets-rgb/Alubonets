import { describe, expect, it } from 'vitest'
import { ageOn, assertEligibleForAdultInvite } from '../lib/family-transition'

describe('family child-to-adult eligibility', () => {
  const today = new Date('2026-08-13T12:00:00Z')

  it('uses the birthday, not only the birth year', () => {
    expect(ageOn(new Date('2008-08-13T00:00:00Z'), today)).toBe(18)
    expect(ageOn(new Date('2008-08-14T00:00:00Z'), today)).toBe(17)
  })

  it('allows the configured threshold exactly', () => {
    expect(assertEligibleForAdultInvite(new Date('2008-08-13T00:00:00Z'), 18, today)).toBe(18)
  })

  it('rejects children and records without birth dates', () => {
    expect(() => assertEligibleForAdultInvite(new Date('2010-01-01T00:00:00Z'), 18, today)).toThrow(/available at age 18/)
    expect(() => assertEligibleForAdultInvite(null, 18, today)).toThrow(/date of birth/i)
  })
})
