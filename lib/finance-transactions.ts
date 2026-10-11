import type { Prisma, TransactionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { APP_TIMEZONE, appDayRange } from '@/lib/dates'
import { formatPaymentMethod } from '@/lib/chart-labels'
import { paginationSkip } from '@/lib/pagination'
import type { FinanceTxRow } from '@/components/finance/FinanceTransactionsTable'

export const FINANCE_TX_PAGE_SIZE = 25
const STATUSES: TransactionStatus[] = ['PENDING', 'CONFIRMED', 'RECONCILED', 'REVERSED', 'REJECTED']
const IN = ['CONTRIBUTION']
const OUT = ['EXPENSE', 'DISBURSEMENT']

export type FinanceTxFilters = { q?: string; year?: string; status?: string; page?: number }

/** One page of ledger transactions for the Financial overview table, newest first. */
export async function getFinanceTransactions(filters: FinanceTxFilters) {
  const q = (filters.q ?? '').trim().slice(0, 100)
  const year = /^\d{4}$/.test(filters.year ?? '') ? filters.year! : ''
  const status = STATUSES.includes(filters.status as TransactionStatus) ? (filters.status as TransactionStatus) : undefined
  const page = Math.max(1, Math.floor(filters.page ?? 1) || 1)
  const where: Prisma.FinancialTransactionWhereInput = {
    ...(year ? { occurredAt: { gte: appDayRange(`${year}-01-01`).start, lte: appDayRange(`${year}-12-31`).end } } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q, mode: 'insensitive' } },
            { providerReference: { contains: q, mode: 'insensitive' } },
            { transactionNumber: { contains: q, mode: 'insensitive' } },
            { contribution: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
            { contribution: { user: { email: { contains: q, mode: 'insensitive' } } } },
            { contribution: { mpesaRef: { contains: q, mode: 'insensitive' } } },
            { expense: { payee: { contains: q, mode: 'insensitive' } } },
            { disbursement: { beneficiary: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const [total, txs] = await Promise.all([
    prisma.financialTransaction.count({ where }),
    prisma.financialTransaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: paginationSkip(page, FINANCE_TX_PAGE_SIZE),
      take: FINANCE_TX_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
        reconciliation: { select: { notes: true, reconciledAt: true, reconciledBy: { select: { fullName: true } } } },
        _count: { select: { supportingDocuments: true } },
        contribution: {
          select: {
            id: true, userId: true, amount: true, paidAt: true, status: true, paymentMethod: true, mpesaRef: true, statementRef: true, contributionPeriod: true, category: true,
            user: { select: { fullName: true, email: true, phone: true } },
            transactionCategory: { select: { name: true } },
            campaign: { select: { title: true } },
            project: { select: { title: true } },
          },
        },
        expense: { select: { payee: true, purpose: true } },
        disbursement: { select: { beneficiary: true } },
      },
    }),
  ])

  const rows: FinanceTxRow[] = txs.map((tx) => {
    const c = tx.contribution
    const purpose = c?.campaign?.title || c?.project?.title || c?.transactionCategory?.name || tx.category?.name || c?.category || tx.expense?.purpose || tx.description
    const reconciliation = tx.reconciliation
      ? { notes: tx.reconciliation.notes, reconciledAt: tx.reconciliation.reconciledAt.toISOString(), reconciledBy: tx.reconciliation.reconciledBy.fullName }
      : null
    return {
      id: tx.id,
      date: tx.occurredAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: APP_TIMEZONE }),
      dateTime: tx.occurredAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE }),
      name: c?.user.fullName ?? (tx.expense?.payee || null) ?? tx.disbursement?.beneficiary ?? tx.description,
      email: c?.user.email ?? null,
      phone: c?.user.phone ?? null,
      purpose,
      method: c ? formatPaymentMethod(c.paymentMethod) : '—',
      status: tx.status,
      flow: IN.includes(tx.type) ? 'in' : OUT.includes(tx.type) ? 'out' : 'other',
      amount: Number(tx.amount),
      number: tx.transactionNumber,
      reference: c?.mpesaRef ?? tx.providerReference,
      statementRef: c?.statementRef ?? null,
      period: c?.contributionPeriod ?? null,
      description: tx.description,
      recordedBy: tx.createdBy.fullName,
      approvedBy: tx.approvedBy?.fullName ?? null,
      documents: tx._count.supportingDocuments,
      contributionId: c?.id ?? null,
      reconcile: c
        ? { id: c.id, memberId: c.userId, memberEmail: c.user.email, memberName: c.user.fullName, amount: c.amount, paidAt: c.paidAt.toISOString(), method: c.paymentMethod, reference: c.mpesaRef, statementRef: c.statementRef, purpose, status: c.status }
        : null,
      reconciliation,
    }
  })
  return { rows, total, page, q, year, status: status ?? '' }
}
