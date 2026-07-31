import { describe, expect, it } from 'vitest'
import {
  balancesFromLinks,
  moneyNumber,
  outstandingFromLinks,
} from '../lib/loans'

describe('moneyNumber', () => {
  it('handles null and decimal-like objects', () => {
    expect(moneyNumber(null)).toBe(0)
    expect(moneyNumber(12.5)).toBe(12.5)
    expect(moneyNumber({ toNumber: () => 9 })).toBe(9)
  })
})

describe('outstandingFromLinks', () => {
  it('computes disbursed minus repaid floored at zero', () => {
    expect(
      outstandingFromLinks([
        { kind: 'DISBURSEMENT', amount: 10000 },
        { kind: 'REPAYMENT', amount: 2500 },
        { kind: 'REPAYMENT', amount: 2500 },
      ]),
    ).toBe(5000)
    expect(
      outstandingFromLinks([
        { kind: 'DISBURSEMENT', amount: 1000 },
        { kind: 'REPAYMENT', amount: 1500 },
      ]),
    ).toBe(0)
  })
})

describe('balancesFromLinks', () => {
  it('maps outstanding per loan id', () => {
    const map = balancesFromLinks(
      ['a', 'b'],
      [
        { loanId: 'a', kind: 'DISBURSEMENT', amount: 5000 },
        { loanId: 'a', kind: 'REPAYMENT', amount: 1000 },
        { loanId: 'b', kind: 'DISBURSEMENT', amount: 2000 },
      ],
    )
    expect(map.get('a')).toBe(4000)
    expect(map.get('b')).toBe(2000)
  })
})
