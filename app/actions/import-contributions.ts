'use server'

import { requireContributionRecorder } from '@/lib/auth/contribution-recorder'
import { canRecordContributionFor } from '@/lib/finance-access'
import { prisma } from '@/lib/prisma'
import { parseContributionCsv, resolveContributionEmail } from '@/lib/contribution-csv'
import { filterSelectableCategories } from '@/lib/payment-categories'
import { assertNotFuture } from '@/lib/dates'
import { recordLedgerContribution } from '@/app/actions/finance'
import Papa from 'papaparse'
import { CONTRIBUTION_CSV_HEADERS } from '@/lib/contribution-csv'
import { NOT_DELETED_MEMBER } from '@/lib/deleted-member'

export async function getContributionResolveMembers() {
  const actor = await requireContributionRecorder()
  const members = await prisma.user.findMany({ where: NOT_DELETED_MEMBER, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true } })
  return members.filter((member) => canRecordContributionFor(actor, member.id))
}

export async function resolveImportedContribution(csv: string, memberId: string) {
  const actor = await requireContributionRecorder()
  if (!canRecordContributionFor(actor, memberId)) throw new Error('You cannot record a contribution for this member.')
  const rows = parseContributionCsv(csv)
  if (rows.length !== 1) throw new Error('Resolve one payment at a time.')
  const member = await prisma.user.findUniqueOrThrow({ where: { id: memberId }, select: { email: true } })
  const row = { ...rows[0], member_email: member.email }
  const corrected = Papa.unparse({ fields: [...CONTRIBUTION_CSV_HEADERS], data: [CONTRIBUTION_CSV_HEADERS.map((key) => row[key])] })
  const result = await importContributionsCsv(corrected)
  if (result.error) throw new Error(result.error)
  if (result.unresolved.length || result.imported !== 1) throw new Error('The selected member email could not be resolved.')
  return { email: member.email }
}

async function prepare(csv: string) {
  const actor = await requireContributionRecorder()
  const rows = parseContributionCsv(csv)
  const [members, categories, accounts, existing] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true } }),
    prisma.transactionCategory.findMany({ where: { active: true } }),
    prisma.financialAccount.findMany({ where: { active: true, type: 'ASSET' } }),
    prisma.financialTransaction.findMany({ where: { providerReference: { in: rows.map((r) => r.transaction_reference) } }, select: { providerReference: true } }),
  ])
  const purposes = filterSelectableCategories(categories, 'income')
  const used = new Set(existing.map((r) => r.providerReference))
  const unresolved: Array<{ rowNumber: number; email: string; amount: number; reference: string; data: typeof rows[number] }> = []
  const resolved = rows.flatMap((row, i) => {
    const fail = (message: string): never => { throw new Error(`Row ${i + 2}: ${message}`) }
    const member = resolveContributionEmail(members, row.member_email)
    if (!member) {
      unresolved.push({ rowNumber: i + 2, email: row.member_email, amount: row.amount, reference: row.transaction_reference, data: row })
      return []
    }
    if (!canRecordContributionFor(actor, member.id)) return fail('Super Admin cannot import their own contribution.')
    const matching = purposes.filter((c) => c.name.toLowerCase() === row.purpose.toLowerCase())
    if (matching.length !== 1) return fail('Purpose must match an existing payment purpose.')
    const account = accounts.filter((a) => a.name.toLowerCase() === row.receiving_account.toLowerCase())
    if (account.length !== 1) return fail('Receiving account must match an existing account.')
    if (used.has(row.transaction_reference)) return fail('Transaction reference has already been imported or recorded.')
    assertNotFuture(new Date(row.date_paid + 'T00:00:00+03:00'), `Row ${i + 2}: payment date`)
    return [{ row, rowNumber: i + 2, memberId: member.id, categoryId: matching[0].id, accountId: account[0].id }]
  })
  return { resolved, unresolved }
}

export async function validateContributionImport(csv: string) {
  const { resolved, unresolved } = await prepare(csv)
  return { count: resolved.length, total: resolved.reduce((n, r) => n + r.row.amount, 0), unresolved }
}

export async function importContributionsCsv(csv: string) {
  const { resolved: prepared, unresolved } = await prepare(csv)
  let imported = 0
  for (const { row, rowNumber, memberId, categoryId, accountId } of prepared) {
    const method = row.payment_method.toUpperCase().replace(/[-\s]/g, '')
    const known = ['MPESA', 'BANK', 'CASH', 'OTHER'].includes(method)
    const fd = new FormData()
    fd.set('userId', memberId)
    fd.set('amount', String(row.amount))
    fd.set('categoryId', categoryId)
    fd.set('sourceAccountId', accountId)
    fd.set('paymentMethod', known ? method : 'OTHER')
    fd.set('description', [row.note, known ? '' : `Payment method: ${row.payment_method}`].filter(Boolean).join(' · ') || 'Imported member contribution')
    fd.set('occurredAt', row.date_paid + 'T00:00:00+03:00')
    fd.set('providerReference', row.transaction_reference)
    try {
      await recordLedgerContribution(fd)
      imported++
    } catch {
      const failedRow = rowNumber
      // A post-save audit/refresh can fail after the ledger transaction commits.
      const saved = await prisma.financialTransaction.findUnique({ where: { providerReference: row.transaction_reference }, select: { id: true } }).catch(() => null)
      if (saved) imported++
      return { imported, unresolved, error: `Import stopped while processing row ${failedRow}. ${imported} payment(s) confirmed saved. Check the ledger and remove saved rows before retrying; references prevent duplicate payments.` }
    }
  }
  return { imported, unresolved, error: null }
}
