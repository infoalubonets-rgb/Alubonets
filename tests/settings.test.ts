import { describe, expect, it } from 'vitest'
import { SETTING_KEYS, validateSettingValue } from '../lib/settings'

describe('validateSettingValue', () => {
  it('accepts branding hex', () => {
    expect(validateSettingValue(SETTING_KEYS.brandingPrimaryHex, '#003366')).toBe('#003366')
  })

  it('rejects invalid hex', () => {
    expect(() => validateSettingValue(SETTING_KEYS.brandingPrimaryHex, 'blue')).toThrow()
  })

  it.each(['password_min_length', 'password_require_mixed'])('rejects removed setting %s', (key) => {
    expect(Object.values(SETTING_KEYS)).not.toContain(key)
    expect(() => validateSettingValue(key as Parameters<typeof validateSettingValue>[0], '8')).toThrow()
  })
  it('accepts loan max amount', () => {
    expect(validateSettingValue(SETTING_KEYS.loanMaxAmountKes, '50000')).toBe('50000')
  })
  it('normalizes and validates multiple contact destinations', () => {
    expect(validateSettingValue(SETTING_KEYS.contactDestinationEmail, ' Info@example.com; team@example.com\nINFO@example.com '))
      .toBe('info@example.com, team@example.com')
    expect(() => validateSettingValue(SETTING_KEYS.contactDestinationEmail, 'info@example.com, invalid'))
      .toThrow('Enter 1 to 20 valid email addresses')
  })
})
