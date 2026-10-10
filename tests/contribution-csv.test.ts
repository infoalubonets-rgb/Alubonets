import { describe, expect, it } from 'vitest'
import { CONTRIBUTION_CSV_HEADERS, parseContributionCsv, resolveContributionEmail } from '../lib/contribution-csv'

const header = CONTRIBUTION_CSV_HEADERS.join(',')
const row = 'member@example.com,500,Monthly Contribution,M-Pesa,Bank account,2026-09-23,REF-001,'
describe('contribution CSV', () => {
  it('matches emails regardless of casing or surrounding spaces', () => { expect(resolveContributionEmail([{ id: '1', email: 'Member@example.com' }], ' member@EXAMPLE.com ')?.id).toBe('1') })
  it('leaves unmatched and ambiguous emails unresolved', () => {
    expect(resolveContributionEmail([], 'unknown@example.com')).toBeNull()
    expect(resolveContributionEmail([{ id: '1', email: 'a@b.com' }, { id: '2', email: 'A@B.COM' }], 'a@b.com')).toBeNull()
  })
  it('accepts past payments and optional notes', () => { expect(parseContributionCsv(header + '\n' + row)[0].amount).toBe(500) })
  it('handles quoted commas and custom methods', () => { expect(parseContributionCsv(header + '\n' + row.replace('M-Pesa', 'Cheque').replace(/,$/, ',"Paid, thank you"'))[0].note).toBe('Paid, thank you') })
  it('rejects invalid amounts', () => { expect(() => parseContributionCsv(header + '\n' + row.replace(',500,', ',-5,'))).toThrow('Row 2') })
  it('rejects duplicate references', () => { expect(() => parseContributionCsv(header + '\n' + row + '\n' + row)).toThrow('duplicate') })
  it('rejects impossible dates', () => { expect(() => parseContributionCsv(header + '\n' + row.replace('2026-09-23', '2026-02-30'))).toThrow('Invalid date') })
  it('rejects wrong template and empty files', () => { expect(() => parseContributionCsv('email,amount\na@b.com,5')).toThrow('template'); expect(() => parseContributionCsv(header)).toThrow('between') })
})
