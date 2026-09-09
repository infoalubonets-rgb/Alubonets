import { describe, expect, it } from 'vitest'
import {
  consumeMfaRecoveryCode,
  generateMfaRecoveryCodes,
  hashMfaRecoveryCode,
} from '../lib/mfa-recovery'

describe('MFA recovery codes', () => {
  it('generates ten unique hashed codes', () => {
    const { codes, stored } = generateMfaRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    const hashes = JSON.parse(stored) as string[]
    expect(hashes).toHaveLength(10)
    expect(hashes).toContain(hashMfaRecoveryCode(codes[0]))
  })

  it('consumes a matching code once', () => {
    const { codes, stored } = generateMfaRecoveryCodes()
    const remaining = consumeMfaRecoveryCode(stored, codes[0])
    expect(remaining).not.toBeNull()
    expect(consumeMfaRecoveryCode(remaining, codes[0])).toBeNull()
    expect(consumeMfaRecoveryCode(stored, 'NOPE-CODE')).toBeNull()
  })
})
