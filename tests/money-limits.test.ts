import { describe, expect, it } from 'vitest'
import { amountError, amountKes, amountKesOrZero } from '../lib/money-limits'

describe('amountKes', () => {
  it('accepts amounts up to KES 999,999', () => {
    expect(amountKes().parse('4000')).toBe(4000)
    expect(amountKes().parse('999999')).toBe(999_999)
  })

  it('rejects zero, negative, huge and non-numeric amounts', () => {
    expect(() => amountKes().parse('0')).toThrow('more than zero')
    expect(() => amountKes().parse('-5')).toThrow('more than zero')
    expect(() => amountKes().parse('1000000')).toThrow('cannot be more than KES 999,999')
    expect(() => amountKes().parse('1' + '0'.repeat(40))).toThrow('cannot be more than KES 999,999')
    expect(() => amountKes().parse('abc')).toThrow()
  })

  it('allows zero only for the or-zero variant', () => {
    expect(amountKesOrZero().parse('0')).toBe(0)
    expect(() => amountKesOrZero().parse('1000000')).toThrow('cannot be more than KES 999,999')
  })
})

describe('amountError', () => {
  it('explains what is wrong with an amount', () => {
    expect(amountError('')).toBe('Enter the amount.')
    expect(amountError('0')).toBe('Amount must be more than zero.')
    expect(amountError('1' + '0'.repeat(40))).toBe('Amount cannot be more than KES 999,999.')
    expect(amountError('250.50')).toBeNull()
  })
})
