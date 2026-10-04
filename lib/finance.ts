import { randomUUID } from 'crypto'
import { Prisma, type PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const transactionNumber = () =>
  `FT-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomUUID().slice(0, 8).toUpperCase()}`

export async function getOpenPeriod(date: Date, tx: Prisma.TransactionClient = prisma) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const period = await tx.accountingPeriod.findUnique({ where: { year_month: { year, month } } })
  if (!period || period.status !== 'OPEN') throw new Error('The accounting period is closed or unavailable.')
  return period
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
    const period = await getOpenPeriod(occurredAt, tx)
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
        periodId: period.id,
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
