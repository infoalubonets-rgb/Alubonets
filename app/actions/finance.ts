'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { createLedgerContribution, getOpenPeriod, refreshObligation, transactionNumber } from '@/lib/finance'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { createServerClient } from '@/lib/supabase-server'

const refreshFinance = () => {
  for (const path of ['/dashboard/treasurer/contributions','/dashboard/treasurer/ledger','/dashboard/treasurer/reconciliation','/dashboard/treasurer/reports','/contributions','/admin/finance']) revalidatePath(path)
  revalidateTag(TAGS.contributions)
}

export async function createContributionCategory(formData: FormData) {
  const actor = await requireAdmin()
  const data = z.object({ code: z.string().trim().min(2).max(40).transform((v) => v.toUpperCase().replace(/\W+/g,'_')), name: z.string().trim().min(2).max(120), type: z.enum(['INCOME','EXPENSE','BOTH']), requiresEvidence: z.coerce.boolean().default(false) }).parse(Object.fromEntries(formData))
  const category = await prisma.transactionCategory.create({ data })
  await writeAudit({ userId: actor.id, action: 'FINANCE_CATEGORY_CREATE', entity: 'TransactionCategory', entityId: category.id, meta: data })
  refreshFinance()
}

export async function createContributionCampaign(formData: FormData) {
  const actor = await requireAdmin()
  const data = z.object({ title: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).optional(), targetAmount: z.coerce.number().positive(), categoryId: z.string().min(1), startsAt: z.coerce.date(), dueAt: z.coerce.date().optional() }).parse({
    title: formData.get('title'), description: formData.get('description') || undefined, targetAmount: formData.get('targetAmount'), categoryId: formData.get('categoryId'), startsAt: formData.get('startsAt'), dueAt: formData.get('dueAt') || undefined,
  })
  const members = await prisma.user.findMany({ where: { status: 'ACTIVE', approvedAt: { lte: data.dueAt || new Date('2999-01-01') } }, select: { id: true } })
  const campaign = await prisma.contributionCampaign.create({
    data: { ...data, createdById: actor.id, obligations: { create: members.map((member) => ({ userId: member.id, targetAmount: data.targetAmount })) } },
  })
  await writeAudit({ userId: actor.id, action: 'CONTRIBUTION_CAMPAIGN_CREATE', entity: 'ContributionCampaign', entityId: campaign.id, meta: { targetAmount: data.targetAmount, members: members.length } })
  refreshFinance()
}

export async function recordLedgerContribution(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({ userId: z.string().min(1), amount: z.coerce.number().positive(), description: z.string().trim().min(2).max(500), categoryId: z.string().min(1), campaignId: z.string().optional(), sourceAccountId: z.string().min(1), paymentMethod: z.enum(['CASH','MPESA','BANK','OTHER']), providerReference: z.string().trim().max(100).optional(), occurredAt: z.coerce.date() }).parse({
    userId: formData.get('userId'), amount: formData.get('amount'), description: formData.get('description'), categoryId: formData.get('categoryId'), campaignId: formData.get('campaignId') || undefined, sourceAccountId: formData.get('sourceAccountId'), paymentMethod: formData.get('paymentMethod'), providerReference: formData.get('providerReference') || undefined, occurredAt: formData.get('occurredAt'),
  })
  const result = await createLedgerContribution({ ...data, receivedBy: actor.fullName, actorId: actor.id })
  await writeAudit({ userId: actor.id, action: 'LEDGER_CONTRIBUTION_CREATE', entity: 'FinancialTransaction', entityId: result.financial.id, meta: { contributionId: result.contribution.id, ...data } })
  refreshFinance()
}

async function uploadEvidence(actorId: string, file: File) {
  if (!file || !file.size) throw new Error('A supporting document is required for every expense.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Supporting document must be 5 MB or smaller.')
  const path = `${actorId}/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
  const admin = createServerClient()
  const { error } = await admin.storage.from('financial-documents').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) throw new Error(`Evidence upload failed: ${error.message}`)
  return { path, mimeType: file.type || 'application/octet-stream', title: file.name }
}

export async function recordExpense(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({ amount: z.coerce.number().positive(), description: z.string().trim().min(2).max(500), payee: z.string().trim().min(2).max(160), purpose: z.string().trim().min(2).max(500), categoryId: z.string().min(1), sourceAccountId: z.string().min(1), occurredAt: z.coerce.date() }).parse(Object.fromEntries(formData))
  const evidence = await uploadEvidence(actor.id, formData.get('evidence') as File)
  const threshold = Number((await prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }))?.value || 50000)
  const approvalRequired = data.amount >= threshold && actor.role !== 'ADMIN'
  const period = await getOpenPeriod(data.occurredAt)
  const transaction = await prisma.financialTransaction.create({
    data: {
      transactionNumber: transactionNumber(), type: 'EXPENSE', status: approvalRequired ? 'PENDING' : 'CONFIRMED', amount: data.amount, description: data.description, occurredAt: data.occurredAt, categoryId: data.categoryId, periodId: period.id, createdById: actor.id, approvedById: approvalRequired ? null : actor.id, confirmedAt: approvalRequired ? null : new Date(),
      entries: { create: [{ accountId: 'acct-expense', debit: data.amount, credit: 0, memo: data.purpose }, { accountId: data.sourceAccountId, debit: 0, credit: data.amount, memo: `Paid to ${data.payee}` }] },
      expense: { create: { payee: data.payee, purpose: data.purpose, approvalRequired } },
      supportingDocuments: { create: { title: evidence.title, fileUrl: evidence.path, mimeType: evidence.mimeType, uploadedById: actor.id } },
    },
  })
  await writeAudit({ userId: actor.id, action: 'EXPENSE_CREATE', entity: 'FinancialTransaction', entityId: transaction.id, meta: { ...data, approvalRequired } })
  refreshFinance()
}

export async function recordWelfareDisbursement(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({
    welfareRequestId: z.string().min(1),
    amount: z.coerce.number().positive(),
    sourceAccountId: z.string().min(1),
    occurredAt: z.coerce.date(),
  }).parse(Object.fromEntries(formData))
  const request = await prisma.welfareRequest.findUniqueOrThrow({
    where: { id: data.welfareRequestId },
    include: { user: true },
  })
  if (request.status !== 'APPROVED') throw new Error('Only approved welfare requests can be paid.')
  const evidence = await uploadEvidence(actor.id, formData.get('evidence') as File)
  const period = await getOpenPeriod(data.occurredAt)
  const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id: 'cat-welfare-disbursement' } })
  const threshold = Number((await prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }))?.value || 50000)
  const approvalRequired = data.amount >= threshold && actor.role !== 'ADMIN'
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.financialTransaction.create({
      data: {
        transactionNumber: transactionNumber(),
        type: 'DISBURSEMENT',
        status: approvalRequired ? 'PENDING' : 'CONFIRMED',
        amount: data.amount,
        description: `Welfare payment to ${request.user.fullName}`,
        occurredAt: data.occurredAt,
        categoryId: category.id,
        periodId: period.id,
        createdById: actor.id,
        approvedById: approvalRequired ? null : actor.id,
        confirmedAt: approvalRequired ? null : new Date(),
        entries: { create: [
          { accountId: 'acct-expense', debit: data.amount, credit: 0, memo: request.description },
          { accountId: data.sourceAccountId, debit: 0, credit: data.amount, memo: `Welfare payment to ${request.user.fullName}` },
        ] },
        disbursement: { create: { beneficiary: request.user.fullName, purpose: request.description, welfareRequestId: request.id } },
        supportingDocuments: { create: { title: evidence.title, fileUrl: evidence.path, mimeType: evidence.mimeType, uploadedById: actor.id } },
      },
    })
    if (!approvalRequired) await tx.welfareRequest.update({ where: { id: request.id }, data: { status: 'PAID' } })
    return created
  })
  await writeAudit({ userId: actor.id, action: 'WELFARE_DISBURSEMENT_CREATE', entity: 'FinancialTransaction', entityId: transaction.id, meta: { ...data, approvalRequired } })
  revalidateTag(TAGS.welfare)
  refreshFinance()
}

export async function approveFinancialTransaction(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const transaction = await prisma.financialTransaction.findUniqueOrThrow({ where: { id } })
  if (transaction.status !== 'PENDING') throw new Error('Only pending transactions can be approved.')
  await prisma.$transaction(async (tx) => {
    await tx.financialTransaction.update({ where: { id }, data: { status: 'CONFIRMED', approvedById: actor.id, confirmedAt: new Date() } })
    const disbursement = await tx.disbursement.findUnique({ where: { transactionId: id } })
    if (disbursement?.welfareRequestId) {
      await tx.welfareRequest.update({ where: { id: disbursement.welfareRequestId }, data: { status: 'PAID' } })
    }
  })
  await writeAudit({ userId: actor.id, action: 'FINANCIAL_TRANSACTION_APPROVE', entity: 'FinancialTransaction', entityId: id })
  refreshFinance()
}

export async function proposeReversal(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  const original = await prisma.financialTransaction.findUniqueOrThrow({ where: { id }, include: { entries: true } })
  if (!['CONFIRMED','RECONCILED'].includes(original.status)) throw new Error('Only confirmed or reconciled transactions can be reversed.')
  const reversal = await prisma.financialTransaction.create({
    data: { transactionNumber: transactionNumber(), type: 'REVERSAL', status: 'PENDING', amount: original.amount, description: `Reversal of ${original.transactionNumber}`, occurredAt: new Date(), correctionReason: reason, periodId: (await getOpenPeriod(new Date())).id, createdById: actor.id, originalTransactionId: original.id, entries: { create: original.entries.map((entry) => ({ accountId: entry.accountId, debit: entry.credit, credit: entry.debit, memo: reason })) }, adjustment: { create: { reason, oldValue: { status: original.status }, newValue: { requestedStatus: 'REVERSED' } } } },
  })
  await writeAudit({ userId: actor.id, action: 'REVERSAL_PROPOSE', entity: 'FinancialTransaction', entityId: reversal.id, meta: { originalId: id, reason } })
  refreshFinance()
}

export async function approveReversal(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const reversal = await prisma.financialTransaction.findUniqueOrThrow({ where: { id } })
  if (reversal.type !== 'REVERSAL' || reversal.status !== 'PENDING' || !reversal.originalTransactionId) throw new Error('Invalid reversal request.')
  await prisma.$transaction([
    prisma.financialTransaction.update({ where: { id }, data: { status: 'CONFIRMED', approvedById: actor.id, confirmedAt: new Date() } }),
    prisma.financialTransaction.update({ where: { id: reversal.originalTransactionId }, data: { status: 'REVERSED', reversedAt: new Date() } }),
    prisma.contribution.updateMany({ where: { financialTransactionId: reversal.originalTransactionId }, data: { status: 'REVERSED', correctionReason: reversal.correctionReason } }),
  ])
  await writeAudit({ userId: actor.id, action: 'REVERSAL_APPROVE', entity: 'FinancialTransaction', entityId: id, meta: { originalId: reversal.originalTransactionId } })
  refreshFinance()
}

export async function reconcilePaymentEvent(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({ eventId: z.string().min(1), userId: z.string().min(1), categoryId: z.string().min(1), campaignId: z.string().optional(), notes: z.string().trim().min(5).max(1000) }).parse({
    eventId: formData.get('eventId'), userId: formData.get('userId'), categoryId: formData.get('categoryId'), campaignId: formData.get('campaignId') || undefined, notes: formData.get('notes'),
  })
  const event = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: data.eventId } })
  if (event.status !== 'UNMATCHED') throw new Error('This provider payment has already been handled.')
  const sourceAccount = event.sourceAccountId || 'acct-mpesa'
  const result = await createLedgerContribution({ userId: data.userId, amount: Number(event.amount), description: `Reconciled ${event.provider} payment`, categoryId: data.categoryId, campaignId: data.campaignId, sourceAccountId: sourceAccount, paymentMethod: event.provider === 'MPESA' ? 'MPESA' : 'OTHER', providerReference: event.providerReference, receivedBy: actor.fullName, actorId: actor.id, occurredAt: event.receivedAt, status: 'RECONCILED' })
  const period = await getOpenPeriod(event.receivedAt)
  await prisma.$transaction([
    prisma.paymentEvent.update({ where: { id: event.id }, data: { status: 'MATCHED', matchedUserId: data.userId, matchedContributionId: result.contribution.id } }),
    prisma.reconciliation.create({ data: { transactionId: result.financial.id, paymentEventId: event.id, periodId: period.id, notes: data.notes, reconciledById: actor.id } }),
    prisma.financialTransaction.update({ where: { id: result.financial.id }, data: { reconciledAt: new Date() } }),
  ])
  await writeAudit({ userId: actor.id, action: 'PAYMENT_RECONCILE', entity: 'PaymentEvent', entityId: event.id, meta: { ...data, contributionId: result.contribution.id } })
  refreshFinance()
}

export async function closeAccountingPeriod(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const openPending = await prisma.financialTransaction.count({ where: { periodId: id, status: 'PENDING' } })
  if (openPending) throw new Error('Resolve pending transactions before closing this period.')
  await prisma.accountingPeriod.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), closedBy: actor.id } })
  await writeAudit({ userId: actor.id, action: 'ACCOUNTING_PERIOD_CLOSE', entity: 'AccountingPeriod', entityId: id })
  refreshFinance()
}

export async function reopenAccountingPeriod(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  await prisma.accountingPeriod.update({ where: { id }, data: { status: 'OPEN', closedAt: null, closedBy: null } })
  await writeAudit({ userId: actor.id, action: 'ACCOUNTING_PERIOD_REOPEN', entity: 'AccountingPeriod', entityId: id })
  refreshFinance()
}

export async function updateApprovalThreshold(formData: FormData) {
  const actor = await requireAdmin()
  const amount = z.coerce.number().positive().parse(formData.get('amount'))
  await prisma.appSetting.upsert({ where: { key: 'financial_approval_threshold_kes' }, create: { key: 'financial_approval_threshold_kes', value: String(amount), updatedBy: actor.id }, update: { value: String(amount), updatedBy: actor.id } })
  await writeAudit({ userId: actor.id, action: 'FINANCE_THRESHOLD_UPDATE', entity: 'AppSetting', entityId: 'financial_approval_threshold_kes', meta: { amount } })
  refreshFinance()
}
