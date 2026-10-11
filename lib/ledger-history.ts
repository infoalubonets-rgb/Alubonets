import type { Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import { rangeFilter, resolveTimeRange } from '@/lib/time-range'
import { prisma } from '@/lib/prisma'

export const LEDGER_PAGE_SIZE = 50
export const LEDGER_STATUSES: TransactionStatus[] = ['PENDING', 'CONFIRMED', 'RECONCILED', 'REVERSED', 'REJECTED']
export const MONEY_IN: TransactionType[] = ['CONTRIBUTION']
export const MONEY_OUT: TransactionType[] = ['EXPENSE', 'DISBURSEMENT']
const CORRECTIONS: TransactionType[] = ['REVERSAL', 'ADJUSTMENT', 'TRANSFER', 'OPENING_BALANCE']

export type LedgerDirection = 'in' | 'out' | 'corrections'
export const DIRECTION_TYPES: Record<LedgerDirection, TransactionType[]> = { in: MONEY_IN, out: MONEY_OUT, corrections: CORRECTIONS }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type LedgerHistoryFilters = {
  range?: string
  from?: string
  to?: string
  category?: string
  dir?: string
  status?: string
  q?: string
  page?: number
}

export type LedgerHistoryRow = {
  id: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  occurredAt: string
  description: string
  category: string | null
  party: string | null
  paymentMethod: string | null
  providerReference: string | null
  reverses: string | null
  correctionReason: string | null
  canApprove?: boolean
  reversalPending?: boolean
  recordedBy: string
  addedAfterClose: boolean
  editedAfterClose: boolean
}

/** Normalised filters: invalid values are dropped, a reversed From/To is swapped. */
export function normaliseLedgerFilters(input: LedgerHistoryFilters) {
  const rawFrom = DATE_RE.test(input.from ?? '') ? input.from! : ''
  const rawTo = DATE_RE.test(input.to ?? '') ? input.to! : ''
  const swapped = Boolean(rawFrom && rawTo && rawFrom > rawTo)
  return {
    from: swapped ? rawTo : rawFrom,
    to: swapped ? rawFrom : rawTo,
    category: input.category?.trim() || '',
    dir: input.dir && input.dir in DIRECTION_TYPES ? (input.dir as LedgerDirection) : undefined,
    status: LEDGER_STATUSES.includes(input.status as TransactionStatus) ? (input.status as TransactionStatus) : undefined,
    q: (input.q ?? '').trim().slice(0, 100),
    page: Math.max(1, Math.floor(input.page ?? 1) || 1),
    swapped,
  }
}

/** One page of ledger transactions matching the history filters, newest first. */
export async function getLedgerHistory(input: LedgerHistoryFilters, actor?: { id: string; canApprove: boolean }) {
  const f = normaliseLedgerFilters(input)
  const where: Prisma.FinancialTransactionWhereInput = {
    ...(rangeFilter(resolveTimeRange({ range: input.range, from: f.from, to: f.to }))
      ? { occurredAt: rangeFilter(resolveTimeRange({ range: input.range, from: f.from, to: f.to })) }
      : {}),
    ...(f.category ? { categoryId: f.category } : {}),
    ...(f.dir ? { type: { in: DIRECTION_TYPES[f.dir] } } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.q
      ? {
          OR: [
            { transactionNumber: { contains: f.q, mode: 'insensitive' } },
            { description: { contains: f.q, mode: 'insensitive' } },
            { providerReference: { contains: f.q, mode: 'insensitive' } },
            { contribution: { user: { fullName: { contains: f.q, mode: 'insensitive' } } } },
            { expense: { payee: { contains: f.q, mode: 'insensitive' } } },
            { disbursement: { beneficiary: { contains: f.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [count, transactions] = await Promise.all([
    prisma.financialTransaction.count({ where }),
    prisma.financialTransaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (f.page - 1) * LEDGER_PAGE_SIZE,
      take: LEDGER_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        originalTransaction: { select: { description: true } },
        reversingTransactions: { where: { status: 'PENDING' }, select: { id: true } },
        contribution: { select: { paymentMethod: true, user: { select: { fullName: true } } } },
        expense: { select: { payee: true } },
        disbursement: { select: { beneficiary: true } },
      },
    }),
  ])

  const rows: LedgerHistoryRow[] = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amount: Number(tx.amount),
    occurredAt: tx.occurredAt.toISOString(),
    description: tx.description,
    category: tx.category?.name ?? null,
    // Expenses no longer ask for a payee; an empty one falls back to the description.
    party: tx.contribution?.user.fullName ?? (tx.expense?.payee || null) ?? tx.disbursement?.beneficiary ?? null,
    paymentMethod: tx.contribution?.paymentMethod ?? null,
    providerReference: tx.providerReference,
    reverses: tx.originalTransaction?.description ?? null,
    correctionReason: tx.correctionReason,
    canApprove: Boolean(actor?.canApprove && tx.createdById !== actor.id),
    reversalPending: Boolean(tx.reversingTransactions?.length),
    recordedBy: tx.createdBy.fullName,
    addedAfterClose: Boolean(tx.addedAfterClose),
    editedAfterClose: Boolean(tx.editedAfterClose),
  }))

  return { rows, count, pageSize: LEDGER_PAGE_SIZE, page: f.page }
}

