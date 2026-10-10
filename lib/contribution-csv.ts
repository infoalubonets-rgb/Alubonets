import Papa from 'papaparse'
import { z } from 'zod'

export const CONTRIBUTION_CSV_HEADERS = ['member_email', 'amount', 'purpose', 'payment_method', 'receiving_account', 'date_paid', 'transaction_reference', 'note'] as const

export function resolveContributionEmail<T extends { id: string; email: string }>(members: T[], email: string) {
  const matches = members.filter((m) => m.email.trim().toLowerCase() === email.trim().toLowerCase())
  return matches.length === 1 ? matches[0] : null
}
const rowSchema = z.object({
  member_email: z.string().trim().email().transform((s) => s.toLowerCase()),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be positive with at most two decimal places').transform(Number).pipe(z.number().positive().finite()),
  purpose: z.string().trim().min(1).max(120),
  payment_method: z.string().trim().min(1).max(100),
  receiving_account: z.string().trim().min(1).max(150),
  date_paid: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => { const d = new Date(s + 'T00:00:00+03:00'); return !Number.isNaN(d.getTime()) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s }, 'Invalid date'),
  transaction_reference: z.string().trim().min(1).max(100),
  note: z.string().trim().max(350).default(''),
})

export function parseContributionCsv(csv: string) {
  if (csv.length > 1_000_000) throw new Error('CSV must be smaller than 1 MB.')
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (s) => s.trim(), transform: (s) => s.trim() })
  if (parsed.errors.length) throw new Error('Invalid CSV: ' + parsed.errors[0].message)
  if (CONTRIBUTION_CSV_HEADERS.some((h) => !parsed.meta.fields?.includes(h)) || parsed.meta.fields?.length !== CONTRIBUTION_CSV_HEADERS.length) throw new Error('Use the downloaded template with its original column headings.')
  if (!parsed.data.length || parsed.data.length > 500) throw new Error('Include between 1 and 500 payments per file.')
  const references = new Set<string>()
  return parsed.data.map((raw, i) => {
    const result = rowSchema.safeParse(raw)
    if (!result.success) throw new Error(`Row ${i + 2}: ${result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`)
    if (references.has(result.data.transaction_reference)) throw new Error(`Row ${i + 2}: duplicate transaction reference.`)
    references.add(result.data.transaction_reference)
    return result.data
  })
}
