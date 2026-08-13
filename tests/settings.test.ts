import { describe, expect, it } from 'vitest'
import { SETTING_KEYS, validateSettingValue } from '../lib/settings'

describe('validateSettingValue', () => {
  it('accepts branding hex', () => {
    expect(validateSettingValue(SETTING_KEYS.brandingPrimaryHex, '#003366')).toBe('#003366')
  })

  it('rejects invalid hex', () => {
    expect(() => validateSettingValue(SETTING_KEYS.brandingPrimaryHex, 'blue')).toThrow()
  })

  it('accepts password min length in range', () => {
    expect(validateSettingValue(SETTING_KEYS.passwordMinLength, '10')).toBe('10')
  })

  it('rejects password min length below 6', () => {
    expect(() => validateSettingValue(SETTING_KEYS.passwordMinLength, '3')).toThrow()
  })

  it('accepts loan max amount', () => {
    expect(validateSettingValue(SETTING_KEYS.loanMaxAmountKes, '50000')).toBe('50000')
  })

  it('validates the configurable adulthood age', () => {
    expect(validateSettingValue(SETTING_KEYS.familyAdulthoodAge, '18')).toBe('18')
    expect(() => validateSettingValue(SETTING_KEYS.familyAdulthoodAge, '12')).toThrow()
    expect(() => validateSettingValue(SETTING_KEYS.familyAdulthoodAge, '26')).toThrow()
  })
})
