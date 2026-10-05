import { randomUUID } from 'crypto'
import { Prisma, type PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appTodayInputValue } from '@/lib/dates'

export const transactionNumber = () =>
  `FT-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomUUID().slice(0, 8).toUpperCase()}`

const DAY_MS = 24 * 60 * 60 * 1000

/** Days after month end before a month closes on its own. */
export const PERIOD_GRACE_DAYS = 7

/** When a month (1–12) closes automatically: 7 days after it ends. */
export function periodAutoClosesAt(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1) + PERIOD_GRACE_DAYS * DAY_MS)
}

export type MonthRef = { year: number; month: number }

/** The calendar month today falls in, in the group's timezone. */
export function currentAccountingMonth(now = new Date()): MonthRef {
  const [year, month] = appTodayInputValue(now).split('-').map(Number)
  return { year, month }
}

export function compareMonths(a: MonthRef, b: MonthRef) {
  return a.year - b.year || a.month - b.month
}

/**
 * Why a month cannot be opened, or null when it can. The current month can always be opened;
 * a future month never; a past month only when something was recorded in it.
 */
export function periodOpenBlocker(target: MonthRef, current: MonthRef, hasData: boolean) {
  const order = compareMonths(target, current)
  if (order > 0) return 'A future month has no data yet and cannot be opened.'
  if (order < 0 && !hasData) return 'This month has no data, so there is nothing to open.'
  return null
}

/** Months (1–12) of `year` with any ledger transaction or confirmed member contribution. */
export async function monthsWithData(year: number) {
  const [periods, contributions] = await Promise.all([
    prisma.accountingPeriod.findMany({ where: { year, transactions: { some: {} } }, select: { month: true } }),
    prisma.contribution.findMany({
      where: {
        status: { in: ['CONFIRMED', 'RECONCILED'] },
        paidAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { paidAt: true },
    }),
  ])
  return new Set([...periods.map((period) => period.month), ...contributions.map((row) => row.paidAt.getUTCMonth() + 1)])
}

/** A past month an admin opened by hand; auto-close leaves it open until they switch back. */
const MANUAL_OPEN_PERIOD_KEY = 'accounting_period_manual_open'

export async function manuallyOpenedPeriodId(tx: Prisma.TransactionClient = prisma) {
  const setting = await tx.appSetting.findUnique({ where: { key: MANUAL_OPEN_PERIOD_KEY } })
  return setting?.value || null
}

export function setManuallyOpenedPeriod(tx: Prisma.TransactionClient, periodId: string | null, actorId: string) {
  return periodId
    ? tx.appSetting.upsert({
        where: { key: MANUAL_OPEN_PERIOD_KEY },
        create: { key: MANUAL_OPEN_PERIOD_KEY, value: periodId, updatedBy: actorId },
        update: { value: periodId, updatedBy: actorId },
      })
    : tx.appSetting.deleteMany({ where: { key: MANUAL_OPEN_PERIOD_KEY } })
}

/** Closes every open month whose grace period has passed, except one an admin reopened by hand. */
export async function autoClosePeriods(tx: Prisma.TransactionClient = prisma, now = new Date()) {
  const keepOpen = await manuallyOpenedPeriodId(tx)
  return tx.accountingPeriod.updateMany({
    where: {
      status: 'OPEN',
      endsAt: { lt: new Date(now.getTime() - PERIOD_GRACE_DAYS * DAY_MS) },
      ...(keepOpen ? { id: { not: keepOpen } } : {}),
    },
    data: { status: 'CLOSED', closedAt: now },
  })
}

/**
 * The accounting month a date falls in, created if missing and closed if its grace period has passed.
 * Never blocks: entries in a closed month are allowed and tagged via `periodFields`.
 */
export async function getPeriodForDate(date: Date, tx: Prisma.TransactionClient = prisma) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  let period =
    (await tx.accountingPeriod.findUnique({ where: { year_month: { year, month } } })) ??
    (await tx.accountingPeriod.upsert({
      where: { year_month: { year, month } },
      create: {
        id: `period-${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        startsAt: new Date(Date.UTC(year, month - 1, 1)),
        endsAt: new Date(Date.UTC(year, month, 1) - 1),
      },
      update: {},
    }))
  if (
    period.status === 'OPEN' &&
    Date.now() >= periodAutoClosesAt(year, month).getTime() &&
    period.id !== (await manuallyOpenedPeriodId(tx))
  ) {
    period = await tx.accountingPeriod.update({ where: { id: period.id }, data: { status: 'CLOSED', closedAt: new Date() } })
  }
  return period
}

/** Period link for a new transaction, tagged when it lands in an already-closed month. */
export function periodFields(period: { id: string; status: string }) {
  return { periodId: period.id, addedAfterClose: period.status === 'CLOSED' }
}

/** Tags a transaction as changed after its month closed (no-op while the month is open). */
export function markEditedAfterClose(transactionId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.financialTransaction.updateMany({
    where: { id: transactionId, period: { status: 'CLOSED' } },
    data: { editedAfterClose: true },
  })
}

export function accountCodeForMethod(method: PaymentMethod) {
  if (method === 'MPESA') return 'MPESA'
  if (method === 'BANK') return 'BANK'
  return 'CASH'
}

export async function refreshObligation(campaignId: string, userId: string, tx: Prisma.TransactionClient = prisma) {
  const obligation = await tx.memberContributionObligation.findUnique({ where: { campaignId_userId: { campaignId, userId } } })
  if (!obligation) return
  const paid = await tx.contribution.aggregate({
    where: { campaignId, userId, status: { in: ['CONFIRMED', 'RECONCILED'] } },
    _sum: { amount: true },
  })
  const paidAmount = new Prisma.Decimal(paid._sum.amount || 0)
  const status = paidAmount.gte(obligation.targetAmount)
    ? 'PAID'
    : paidAmount.gt(0)
      ? 'PARTIALLY_PAID'
      : 'OUTSTANDING'
  await tx.memberContributionObligation.update({ where: { id: obligation.id }, data: { status } })
}

export async function createLedgerContribution(input: {
  userId: string
  amount: number
  description: string
  categoryId: string
  campaignId?: string | null
  projectId?: string | null
  /** YYYY-MM month a monthly fee covers; defaults to the payment month for monthly purposes. */
  contributionPeriod?: string | null
  sourceAccountId: string
  paymentMethod: PaymentMethod
  providerReference?: string | null
  receivedBy: string
  actorId: string
  occurredAt?: Date
  status?: 'PENDING' | 'CONFIRMED' | 'RECONCILED' | 'REJECTED'
  proofPath?: string | null
  proofMimeType?: string | null
  proofTitle?: string | null
}) {
  const occurredAt = input.occurredAt || new Date()
  const result = await prisma.$transaction(async (tx) => {
    const period = await getPeriodForDate(occurredAt, tx)
    const source = await tx.financialAccount.findUniqueOrThrow({ where: { id: input.sourceAccountId } })
    if (input.providerReference) {
      const duplicate = await tx.financialTransaction.findUnique({ where: { providerReference: input.providerReference } })
      if (duplicate) throw new Error(`Transaction reference ${input.providerReference} has already been used.`)
    }
    const payer = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { id: true, isPrincipal: true, principalMemberId: true },
    })
    const principalMemberId = payer.isPrincipal ? payer.id : payer.principalMemberId
    const status = input.status || 'PENDING'
    const financial = await tx.financialTransaction.create({
      data: {
        transactionNumber: transactionNumber(),
        type: 'CONTRIBUTION',
        status,
        amount: input.amount,
        description: input.description,
        occurredAt,
        providerReference: input.providerReference || null,
        categoryId: input.categoryId,
        ...periodFields(period),
        createdById: input.actorId,
        confirmedAt: status === 'PENDING' || status === 'REJECTED' ? null : new Date(),
        entries: {
          create: [
            { accountId: source.id, debit: input.amount, credit: 0, memo: 'Money received' },
            { accountId: 'acct-contribution-income', debit: 0, credit: input.amount, memo: 'Contribution income' },
          ],
        },
        supportingDocuments: input.proofPath
          ? {
              create: {
                title: input.proofTitle || 'Payment proof',
                fileUrl: input.proofPath,
                mimeType: input.proofMimeType || 'application/octet-stream',
                uploadedById: input.actorId,
              },
            }
          : undefined,
      },
    })
    const category = await tx.transactionCategory.findUniqueOrThrow({ where: { id: input.categoryId } })
    const allocation = await tx.fundAllocationRule.findFirst({
      where: { active: true },
      orderBy: { version: 'desc' },
    })
    const emergencyPercent = allocation?.emergencyPercent ?? 20
    const reservePercent = allocation?.reservePercent ?? 80
    const contribution = await tx.contribution.create({
      data: {
        userId: input.userId,
        principalMemberId,
        amount: input.amount,
        description: input.description,
        category: category.name,
        categoryId: input.categoryId,
        campaignId: input.campaignId || null,
        projectId: input.projectId || null,
        contributionPeriod: input.contributionPeriod
          || (category.billingKind === 'MONTHLY' ? occurredAt.toISOString().slice(0, 7) : null),
        sourceAccountId: input.sourceAccountId,
        paymentMethod: input.paymentMethod,
        mpesaRef: input.providerReference || null,
        receivedBy: input.receivedBy,
        paidAt: occurredAt,
        status,
        reconciliationStatus: status === 'RECONCILED' ? 'RECONCILED' : 'UNRECONCILED',
        financialTransactionId: financial.id,
        allocationVersion: allocation?.version ?? 1,
        emergencyPercent,
        reservePercent,
        emergencyAmount: Number(((input.amount * emergencyPercent) / 100).toFixed(2)),
        reserveAmount: Number(((input.amount * reservePercent) / 100).toFixed(2)),
      },
    })
    if (input.campaignId) await refreshObligation(input.campaignId, input.userId, tx)
    return { contribution, financial }
  })
  if (result.contribution.status === 'CONFIRMED' || result.contribution.status === 'RECONCILED') {
    await recomputeStandingSafely(input.userId, input.actorId)
  }
  if (input.projectId) {
    const { syncProjectFinancials } = await import('@/lib/project-status')
    await syncProjectFinancials(input.projectId).catch(() => {})
  }
  return result
}

/** Standing must never block a payment from being recorded. */
export async function recomputeStandingSafely(userId: string, actorId?: string) {
  try {
    const { recomputeMemberStanding } = await import('@/lib/membership-standing-sync')
    await recomputeMemberStanding(userId, actorId)
  } catch (error) {
    console.error('[standing] recompute failed', error)
  }
}

export async function accountBalances() {
  const accounts = await prisma.financialAccount.findMany({ where: { active: true }, orderBy: { code: 'asc' }, include: { entries: { where: { transaction: { status: { in: ['CONFIRMED', 'RECONCILED'] } } }, select: { debit: true, credit: true } } } })
  return accounts.map((account) => ({
    ...account,
    balance: account.entries.reduce((sum, entry) => sum + Number(entry.debit) - Number(entry.credit), 0),
  }))
}
