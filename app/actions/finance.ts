'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { createLedgerContribution, getOpenPeriod, recomputeStandingSafely, refreshObligation, transactionNumber } from '@/lib/finance'
import { getStandingSettings, saveStandingSettings } from '@/lib/membership-standing-settings'
import { syncMembershipStanding } from '@/lib/membership-standing-sync'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { createSignedUpload } from '@/lib/upload-signed'
import { requireWelfareEnabled } from '@/lib/feature-flags'
import { assertNotFuture, assertNotPast } from '@/lib/dates'
import { notifyUsers } from '@/lib/notifications'
import {
  filterSelectableCategories,
  otherCategoryDescriptionSchema,
  paymentDescription,
  resolvePaymentCategory,
  uniqueCategoryCode,
} from '@/lib/payment-categories'

const refreshFinance = () => {
  for (const path of ['/dashboard/treasurer/contributions','/dashboard/treasurer/ledger','/dashboard/treasurer/reconciliation','/dashboard/treasurer/reports','/contributions','/admin/finance']) revalidatePath(path)
  revalidateTag(TAGS.contributions)
}

export async function createContributionCategory(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const name = z.string().trim().min(2).max(80).parse(formData.get('name'))
  const duplicate = await prisma.transactionCategory.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) throw new Error('A category with this name already exists.')
  const code = await uniqueCategoryCode(name)
  const category = await prisma.transactionCategory.create({
    data: { code, name, type: 'BOTH' },
  })
  await writeAudit({ userId: actor.id, action: 'FINANCE_CATEGORY_CREATE', entity: 'TransactionCategory', entityId: category.id, meta: { name, code } })
  refreshFinance()
}

const campaignSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  targetAmount: z.coerce.number().positive('Enter the overall campaign target.'),
  perMemberTarget: z.coerce.number().positive().optional(),
  categoryId: z.string().min(1),
  startsAt: z.coerce.date(),
  dueAt: z.coerce.date().optional(),
})

function parseCampaignForm(formData: FormData) {
  const data = campaignSchema.parse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    targetAmount: formData.get('targetAmount'),
    perMemberTarget: formData.get('perMemberTarget') || undefined,
    categoryId: formData.get('categoryId'),
    startsAt: formData.get('startsAt'),
    dueAt: formData.get('dueAt') || undefined,
  })
  if (data.dueAt && data.dueAt < data.startsAt) throw new Error('Campaign due date cannot fall before its start date.')
  return data
}

const refreshCampaigns = (campaignId?: string) => {
  refreshFinance()
  revalidatePath('/dashboard/treasurer/campaigns')
  if (campaignId) revalidatePath(`/dashboard/treasurer/campaigns/${campaignId}`)
}

/** Campaigns may start in the past so historical collections can be recorded against them. */
export async function createContributionCampaign(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const data = parseCampaignForm(formData)
  const campaign = await prisma.contributionCampaign.create({
    data: { ...data, perMemberTarget: data.perMemberTarget ?? null, createdById: actor.id },
  })
  const { syncCampaignObligations } = await import('@/lib/campaigns')
  const { created } = await syncCampaignObligations(campaign.id)
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CAMPAIGN_CREATE',
    entity: 'ContributionCampaign',
    entityId: campaign.id,
    meta: { targetAmount: data.targetAmount, perMemberTarget: data.perMemberTarget ?? null, members: created },
  })
  refreshCampaigns(campaign.id)
}

export async function updateContributionCampaign(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const campaignId = z.string().min(1).parse(formData.get('campaignId'))
  const data = parseCampaignForm(formData)
  const old = await prisma.contributionCampaign.findUniqueOrThrow({ where: { id: campaignId } })
  const updated = await prisma.contributionCampaign.update({
    where: { id: campaignId },
    data: { ...data, description: data.description ?? null, dueAt: data.dueAt ?? null, perMemberTarget: data.perMemberTarget ?? null },
  })
  if (updated.perMemberTarget) {
    const { syncCampaignObligations } = await import('@/lib/campaigns')
    await syncCampaignObligations(campaignId)
  }
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CAMPAIGN_UPDATE',
    entity: 'ContributionCampaign',
    entityId: campaignId,
    oldValue: { title: old.title, targetAmount: old.targetAmount, perMemberTarget: old.perMemberTarget, startsAt: old.startsAt, dueAt: old.dueAt },
    newValue: { title: updated.title, targetAmount: updated.targetAmount, perMemberTarget: updated.perMemberTarget, startsAt: updated.startsAt, dueAt: updated.dueAt },
  })
  refreshCampaigns(campaignId)
}

export async function setContributionCampaignActive(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const data = z.object({ campaignId: z.string().min(1), active: z.enum(['true', 'false']) }).parse({
    campaignId: formData.get('campaignId'),
    active: formData.get('active'),
  })
  const active = data.active === 'true'
  await prisma.contributionCampaign.update({ where: { id: data.campaignId }, data: { active } })
  await writeAudit({
    userId: actor.id,
    action: active ? 'CONTRIBUTION_CAMPAIGN_ACTIVATE' : 'CONTRIBUTION_CAMPAIGN_DEACTIVATE',
    entity: 'ContributionCampaign',
    entityId: data.campaignId,
  })
  refreshCampaigns(data.campaignId)
}

export async function waiveCampaignObligation(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const data = z.object({
    obligationId: z.string().min(1),
    reason: z.string().trim().min(3, 'Give a short reason for the waiver.').max(300),
  }).parse({ obligationId: formData.get('obligationId'), reason: formData.get('reason') })
  const obligation = await prisma.memberContributionObligation.update({
    where: { id: data.obligationId },
    data: { status: 'WAIVED', waivedReason: data.reason },
  })
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_OBLIGATION_WAIVE',
    entity: 'MemberContributionObligation',
    entityId: obligation.id,
    reason: data.reason,
    meta: { campaignId: obligation.campaignId, memberId: obligation.userId },
  })
  refreshCampaigns(obligation.campaignId)
}

export async function restoreCampaignObligation(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const obligationId = z.string().min(1).parse(formData.get('obligationId'))
  const obligation = await prisma.memberContributionObligation.update({
    where: { id: obligationId },
    data: { status: 'OUTSTANDING', waivedReason: null },
  })
  await refreshObligation(obligation.campaignId, obligation.userId)
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_OBLIGATION_RESTORE',
    entity: 'MemberContributionObligation',
    entityId: obligation.id,
    meta: { campaignId: obligation.campaignId, memberId: obligation.userId },
  })
  refreshCampaigns(obligation.campaignId)
}

export async function recordLedgerContribution(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const raw = {
    userId: formData.get('userId'),
    amount: formData.get('amount'),
    description: formData.get('description'),
    categoryId: formData.get('categoryId'),
    otherCategoryDescription: formData.get('otherCategoryDescription'),
    campaignId: formData.get('campaignId') || undefined,
    projectId: formData.get('projectId') || undefined,
    contributionPeriod: formData.get('contributionPeriod') || undefined,
    sourceAccountId: formData.get('sourceAccountId'),
    paymentMethod: formData.get('paymentMethod'),
    providerReference: formData.get('providerReference') || undefined,
    occurredAt: formData.get('occurredAt'),
  }
  const data = z.object({
    userId: z.string().min(1),
    amount: z.coerce.number().positive(),
    description: z.string().trim().max(500).optional(),
    categoryId: z.string().default(''),
    otherCategoryDescription: z.string().trim().optional(),
    campaignId: z.string().optional(),
    projectId: z.string().optional(),
    contributionPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose the month this payment covers.').optional(),
    sourceAccountId: z.string().min(1),
    paymentMethod: z.enum(['CASH','MPESA','BANK','OTHER']),
    providerReference: z.string().trim().max(100).optional(),
    occurredAt: z.coerce.date(),
  }).parse(raw)
  const { categoryId, otherLabel } = await resolvePaymentCategory({
    categoryId: data.categoryId,
    otherCategoryDescription: data.otherCategoryDescription,
    actorId: actor.id,
    projectId: data.projectId,
  })
  if (!otherLabel) {
    z.string().trim().min(2).max(500).parse(data.description)
  } else {
    otherCategoryDescriptionSchema.parse(data.otherCategoryDescription)
  }
  const description = paymentDescription(data.description?.trim() || 'Member contribution', otherLabel)
  assertNotFuture(data.occurredAt, 'Contribution date')
  const evidence = z.object({
    evidencePath: z.string().min(1, 'A receipt or proof of payment is required for every contribution.'),
    evidenceMimeType: z.string().min(1),
    evidenceTitle: z.string().min(1),
  }).parse({
    evidencePath: formData.get('evidencePath'),
    evidenceMimeType: formData.get('evidenceMimeType'),
    evidenceTitle: formData.get('evidenceTitle'),
  })
  // Incoming contributions are never held by the expense approval limit.
  const status = 'CONFIRMED'
  const result = await createLedgerContribution({
    ...data,
    categoryId,
    description,
    receivedBy: actor.fullName,
    actorId: actor.id,
    status,
    proofPath: evidence.evidencePath,
    proofMimeType: evidence.evidenceMimeType,
    proofTitle: evidence.evidenceTitle,
  })
  await writeAudit({ userId: actor.id, action: 'LEDGER_CONTRIBUTION_CREATE', entity: 'FinancialTransaction', entityId: result.financial.id, meta: { contributionId: result.contribution.id, status, ...data } })
  refreshFinance()
}

/** Step 1 of a fast upload: authorize, then hand back a signed URL for a direct browser→Supabase upload. */
export async function requestEvidenceUploadUrl(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const fileName = z.string().min(1).parse(formData.get('fileName'))
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${actor.id}/${Date.now()}-${crypto.randomUUID()}-${safe}`
  return createSignedUpload('financial-documents', path)
}

export async function recordExpense(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({
    amount: z.coerce.number().positive(),
    description: z.string().trim().max(500).optional(),
    otherCategoryDescription: z.string().trim().optional(),
    payee: z.string().trim().min(2).max(160),
    purpose: z.string().trim().min(2).max(500),
    categoryId: z.string().default(''),
    projectId: z.string().optional().transform((value) => value || undefined),
    sourceAccountId: z.string().min(1),
    occurredAt: z.coerce.date(),
  }).parse(Object.fromEntries(formData))
  const { categoryId, otherLabel } = await resolvePaymentCategory({
    categoryId: data.categoryId,
    otherCategoryDescription: data.otherCategoryDescription,
    actorId: actor.id,
    projectId: data.projectId,
  })
  if (!otherLabel) {
    z.string().trim().min(2).max(500).parse(data.description)
  } else {
    otherCategoryDescriptionSchema.parse(data.otherCategoryDescription)
  }
  const description = paymentDescription(data.description?.trim() || `Expense — ${data.payee}`, otherLabel)
  assertNotFuture(data.occurredAt, 'Expense date')
  const evidence = z.object({
    evidencePath: z.string().min(1, 'A supporting document is required for every expense.'),
    evidenceMimeType: z.string().min(1),
    evidenceTitle: z.string().min(1),
  }).parse({
    evidencePath: formData.get('evidencePath'),
    evidenceMimeType: formData.get('evidenceMimeType'),
    evidenceTitle: formData.get('evidenceTitle'),
  })
  const threshold = Number((await prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }))?.value || 50000)
  // Guide: Admin must not bypass finance approval merely because of system role.
  const approvalRequired = data.amount > threshold
  const period = await getOpenPeriod(data.occurredAt)
  const transaction = await prisma.financialTransaction.create({
    data: {
      transactionNumber: transactionNumber(), type: 'EXPENSE', status: approvalRequired ? 'PENDING' : 'CONFIRMED', amount: data.amount, description, occurredAt: data.occurredAt, categoryId, periodId: period.id, createdById: actor.id, approvedById: approvalRequired ? null : actor.id, confirmedAt: approvalRequired ? null : new Date(),
      entries: { create: [{ accountId: 'acct-expense', debit: data.amount, credit: 0, memo: data.purpose }, { accountId: data.sourceAccountId, debit: 0, credit: data.amount, memo: `Paid to ${data.payee}` }] },
      expense: { create: { payee: data.payee, purpose: data.purpose, approvalRequired, projectId: data.projectId ?? null } },
      supportingDocuments: { create: { title: evidence.evidenceTitle, fileUrl: evidence.evidencePath, mimeType: evidence.evidenceMimeType, uploadedById: actor.id } },
    },
  })
  await writeAudit({ userId: actor.id, action: 'EXPENSE_CREATE', entity: 'FinancialTransaction', entityId: transaction.id, meta: { ...data, approvalRequired } })
  if (data.projectId) {
    const { syncProjectFinancials } = await import('@/lib/project-status')
    await syncProjectFinancials(data.projectId)
  }
  refreshFinance()
}

export async function recordWelfareDisbursement(formData: FormData) {
  await requireWelfareEnabled()
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({
    welfareRequestId: z.string().min(1),
    amount: z.coerce.number().positive(),
    sourceAccountId: z.string().min(1),
    occurredAt: z.coerce.date(),
  }).parse(Object.fromEntries(formData))
  assertNotFuture(data.occurredAt, 'Payment date')
  const request = await prisma.welfareRequest.findUniqueOrThrow({
    where: { id: data.welfareRequestId },
    include: { user: true },
  })
  if (request.status !== 'APPROVED') throw new Error('Only approved welfare requests can be paid.')
  const evidence = z.object({
    evidencePath: z.string().min(1, 'A supporting document is required for every disbursement.'),
    evidenceMimeType: z.string().min(1),
    evidenceTitle: z.string().min(1),
  }).parse({
    evidencePath: formData.get('evidencePath'),
    evidenceMimeType: formData.get('evidenceMimeType'),
    evidenceTitle: formData.get('evidenceTitle'),
  })
  const period = await getOpenPeriod(data.occurredAt)
  const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id: 'cat-welfare-disbursement' } })
  const threshold = Number((await prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }))?.value || 50000)
  // Guide: Admin must not bypass finance approval merely because of system role.
  const approvalRequired = data.amount > threshold
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
        supportingDocuments: { create: { title: evidence.evidenceTitle, fileUrl: evidence.evidencePath, mimeType: evidence.evidenceMimeType, uploadedById: actor.id } },
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
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const transaction = await prisma.financialTransaction.findUniqueOrThrow({ where: { id } })
  if (transaction.status !== 'PENDING') throw new Error('Only pending transactions can be approved.')
  // Maker-checker: whoever created/recorded this transaction cannot also approve it.
  if (transaction.createdById === actor.id) {
    throw new Error('You recorded this transaction — a different Admin or Treasurer must approve it.')
  }
  const confirmed = await prisma.$transaction(async (tx) => {
    await tx.financialTransaction.update({ where: { id }, data: { status: 'CONFIRMED', approvedById: actor.id, confirmedAt: new Date() } })
    const linked = await tx.contribution.findUnique({ where: { financialTransactionId: id } })
    if (linked && linked.status === 'PENDING') {
      await tx.contribution.update({ where: { id: linked.id }, data: { status: 'CONFIRMED', verifiedAt: new Date(), verifiedById: actor.id } })
      if (linked.campaignId) await refreshObligation(linked.campaignId, linked.userId, tx)
    }
    const disbursement = await tx.disbursement.findUnique({ where: { transactionId: id } })
    if (disbursement?.welfareRequestId) {
      await tx.welfareRequest.update({ where: { id: disbursement.welfareRequestId }, data: { status: 'PAID' } })
    }
    const loanLink = await tx.loanLedgerLink.findUnique({ where: { transactionId: id } })
    if (loanLink?.kind === 'DISBURSEMENT') {
      await tx.loanApplication.update({
        where: { id: loanLink.loanId },
        data: { status: 'DISBURSED', disbursedAt: new Date() },
      })
    }
    const expense = await tx.expense.findUnique({ where: { transactionId: id }, select: { projectId: true } })
    return { linked, expenseProjectId: expense?.projectId ?? null }
  })
  const { linked: confirmedContribution, expenseProjectId } = confirmed
  if (confirmedContribution) await recomputeStandingSafely(confirmedContribution.userId, actor.id)
  const touchedProjectId = expenseProjectId ?? confirmedContribution?.projectId ?? null
  if (touchedProjectId) {
    const { syncProjectFinancials } = await import('@/lib/project-status')
    await syncProjectFinancials(touchedProjectId).catch(() => {})
  }
  await writeAudit({
    userId: actor.id,
    action: 'FINANCIAL_TRANSACTION_APPROVE',
    entity: 'FinancialTransaction',
    entityId: id,
    reason: 'Pending financial transaction approved',
    oldValue: { status: transaction.status },
    newValue: { status: 'CONFIRMED', approvedById: actor.id },
  })
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
  await writeAudit({ userId: actor.id, action: 'REVERSAL_PROPOSE', entity: 'FinancialTransaction', entityId: reversal.id, reason, oldValue: { originalId: id, status: original.status }, newValue: { reversalId: reversal.id, status: 'PENDING' }, meta: { originalId: id, reason } })
  refreshFinance()
}

export async function approveReversal(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const reversal = await prisma.financialTransaction.findUniqueOrThrow({ where: { id } })
  if (reversal.type !== 'REVERSAL' || reversal.status !== 'PENDING' || !reversal.originalTransactionId) throw new Error('Invalid reversal request.')
  // Maker-checker: whoever proposed this reversal cannot also approve it.
  if (reversal.createdById === actor.id) {
    throw new Error('You proposed this reversal — a different Admin or Treasurer must approve it.')
  }
  await prisma.$transaction([
    prisma.financialTransaction.update({ where: { id }, data: { status: 'CONFIRMED', approvedById: actor.id, confirmedAt: new Date() } }),
    prisma.financialTransaction.update({ where: { id: reversal.originalTransactionId }, data: { status: 'REVERSED', reversedAt: new Date() } }),
    prisma.contribution.updateMany({ where: { financialTransactionId: reversal.originalTransactionId }, data: { status: 'REVERSED', correctionReason: reversal.correctionReason } }),
  ])
  const reversedContribution = await prisma.contribution.findUnique({ where: { financialTransactionId: reversal.originalTransactionId }, select: { userId: true } })
  if (reversedContribution) await recomputeStandingSafely(reversedContribution.userId, actor.id)
  await writeAudit({ userId: actor.id, action: 'REVERSAL_APPROVE', entity: 'FinancialTransaction', entityId: id, reason: reversal.correctionReason || 'Reversal approved', oldValue: { status: reversal.status }, newValue: { status: 'CONFIRMED', originalId: reversal.originalTransactionId }, meta: { originalId: reversal.originalTransactionId } })
  refreshFinance()
}

export async function reconcilePaymentEvent(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER','ADMIN'])
  const data = z.object({
    eventId: z.string().min(1),
    userId: z.string().min(1),
    categoryId: z.string().default(''),
    otherCategoryDescription: z.string().trim().optional(),
    campaignId: z.string().optional(),
    projectId: z.string().optional(),
    notes: z.string().trim().min(5).max(1000),
  }).parse({
    eventId: formData.get('eventId'),
    userId: formData.get('userId'),
    categoryId: formData.get('categoryId') || '',
    otherCategoryDescription: formData.get('otherCategoryDescription') || undefined,
    campaignId: formData.get('campaignId') || undefined,
    projectId: formData.get('projectId') || undefined,
    notes: formData.get('notes'),
  })
  const { categoryId, otherLabel } = await resolvePaymentCategory({
    categoryId: data.categoryId,
    otherCategoryDescription: data.otherCategoryDescription,
    actorId: actor.id,
    projectId: data.projectId,
  })
  if (otherLabel) otherCategoryDescriptionSchema.parse(data.otherCategoryDescription)
  const event = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: data.eventId } })
  if (event.status !== 'UNMATCHED') throw new Error('This provider payment has already been handled.')
  const sourceAccount = event.sourceAccountId || 'acct-mpesa'
  const result = await createLedgerContribution({
    userId: data.userId,
    amount: Number(event.amount),
    description: paymentDescription(`Reconciled ${event.provider} payment`, otherLabel),
    categoryId,
    campaignId: data.campaignId,
    projectId: data.projectId,
    sourceAccountId: sourceAccount,
    paymentMethod: event.provider === 'MPESA' ? 'MPESA' : 'OTHER',
    providerReference: event.providerReference,
    receivedBy: actor.fullName,
    actorId: actor.id,
    occurredAt: event.receivedAt,
    status: 'RECONCILED',
  })
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
  await writeAudit({ userId: actor.id, action: 'ACCOUNTING_PERIOD_CLOSE', entity: 'AccountingPeriod', entityId: id, reason: 'Accounting period closed', oldValue: { status: 'OPEN' }, newValue: { status: 'CLOSED' } })
  refreshFinance()
}

export async function reopenAccountingPeriod(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  await prisma.accountingPeriod.update({ where: { id }, data: { status: 'OPEN', closedAt: null, closedBy: null } })
  await writeAudit({ userId: actor.id, action: 'ACCOUNTING_PERIOD_REOPEN', entity: 'AccountingPeriod', entityId: id, reason: 'Accounting period reopened', oldValue: { status: 'CLOSED' }, newValue: { status: 'OPEN' } })
  refreshFinance()
}

export async function updateApprovalThreshold(formData: FormData): Promise<{ ok: true; amount: number }> {
  try {
    const actor = await requireAdmin()
    const amount = z.coerce.number().positive().parse(formData.get('amount'))
    await prisma.appSetting.upsert({
      where: { key: 'financial_approval_threshold_kes' },
      create: { key: 'financial_approval_threshold_kes', value: String(amount), updatedBy: actor.id },
      update: { value: String(amount), updatedBy: actor.id },
    })
    await writeAudit({
      userId: actor.id,
      action: 'FINANCE_THRESHOLD_UPDATE',
      entity: 'AppSetting',
      entityId: 'financial_approval_threshold_kes',
      meta: { amount },
    })
    refreshFinance()
    return { ok: true, amount }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not save approval threshold.')
  }
}

export async function updateLoanApplicationLimit(formData: FormData): Promise<{ ok: true; amount: number }> {
  try {
    const actor = await requireAdmin()
    const amount = z.coerce.number().int().min(100).max(999_999).parse(formData.get('amount'))
    await prisma.appSetting.upsert({
      where: { key: 'loan_max_amount_kes' },
      create: { key: 'loan_max_amount_kes', value: String(amount), updatedBy: actor.id },
      update: { value: String(amount), updatedBy: actor.id },
    })
    await writeAudit({
      userId: actor.id,
      action: 'LOAN_LIMIT_UPDATE',
      entity: 'AppSetting',
      entityId: 'loan_max_amount_kes',
      meta: { amount },
    })
    refreshFinance()
    return { ok: true, amount }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not save loan limit.')
  }
}

export async function updateStandingSettings(formData: FormData): Promise<{ ok: true; lapsed: number; reactivated: number }> {
  try {
    const actor = await requireAdmin()
    const previous = await getStandingSettings()
    const data = z.object({
      autoEnabled: z.enum(['true', 'false']),
      monthlyFeeKes: z.coerce.number().min(0).max(1_000_000),
      monthlyGraceDays: z.coerce.number().int().min(0).max(120),
      annualFeeKes: z.coerce.number().min(0).max(10_000_000),
      annualRenewalDays: z.coerce.number().int().min(0).max(365),
      effectiveFrom: z.coerce.date(),
    }).parse({
      autoEnabled: formData.get('autoEnabled') === 'on' || formData.get('autoEnabled') === 'true' ? 'true' : 'false',
      monthlyFeeKes: formData.get('monthlyFeeKes') || 0,
      monthlyGraceDays: formData.get('monthlyGraceDays'),
      annualFeeKes: formData.get('annualFeeKes') || 0,
      annualRenewalDays: formData.get('annualRenewalDays'),
      effectiveFrom: formData.get('effectiveFrom'),
    })
    const next = { ...data, autoEnabled: data.autoEnabled === 'true' }
    await saveStandingSettings(next, actor.id)
    await writeAudit({
      userId: actor.id,
      action: 'MEMBERSHIP_STANDING_SETTINGS_UPDATE',
      entity: 'AppSetting',
      entityId: 'standing_settings',
      oldValue: { ...previous, effectiveFrom: previous.effectiveFrom.toISOString() },
      newValue: { ...next, effectiveFrom: next.effectiveFrom.toISOString() },
    })
    const result = await syncMembershipStanding()
    refreshFinance()
    revalidatePath('/admin/members')
    return { ok: true, lapsed: result.lapsed, reactivated: result.reactivated }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not save membership standing settings.')
  }
}

export async function verifyContribution(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const id = z.string().min(1).parse(formData.get('id'))
  const decision = z.enum(['verify', 'reject']).parse(formData.get('decision'))
  const note = z.string().trim().max(1000).optional().parse(formData.get('note') || undefined)
  const contribution = await prisma.contribution.findUniqueOrThrow({
    where: { id },
    include: { financialTransaction: { select: { createdById: true } } },
  })
  if (contribution.status !== 'PENDING') throw new Error('Only pending payments can be verified or rejected.')
  // Maker-checker: whoever recorded this contribution cannot also verify it.
  if (contribution.financialTransaction?.createdById === actor.id) {
    throw new Error('You recorded this contribution — a different Treasurer or Admin must verify it.')
  }
  const status = decision === 'verify' ? 'CONFIRMED' : 'REJECTED'
  await prisma.$transaction([
    prisma.contribution.update({
      where: { id },
      data: {
        status,
        verificationNote: note || null,
        verifiedAt: new Date(),
        verifiedById: actor.id,
      },
    }),
    ...(contribution.financialTransactionId
      ? [
          prisma.financialTransaction.update({
            where: { id: contribution.financialTransactionId },
            data: {
              status,
              confirmedAt: decision === 'verify' ? new Date() : null,
              approvedById: decision === 'verify' ? actor.id : null,
            },
          }),
        ]
      : []),
  ])
  await writeAudit({
    userId: actor.id,
    action: decision === 'verify' ? 'CONTRIBUTION_VERIFY' : 'CONTRIBUTION_REJECT',
    entity: 'Contribution',
    entityId: id,
    reason: note,
    oldValue: { status: contribution.status },
    newValue: { status },
  })
  if (contribution.campaignId) await refreshObligation(contribution.campaignId, contribution.userId)
  if (decision === 'verify') await recomputeStandingSafely(contribution.userId, actor.id)
  await notifyUsers({
    userIds: [contribution.userId],
    title: decision === 'verify' ? 'Payment confirmed' : 'Payment rejected',
    body: note || (decision === 'verify'
      ? 'The Treasurer confirmed your recorded contribution.'
      : 'The Treasurer rejected a recorded contribution.'),
    href: '/contributions',
    type: 'payment',
    entity: 'Contribution',
    entityId: id,
  })
  refreshFinance()
}

export async function publishFinanceDestination(formData: FormData) {
  const actor = await requireAdmin()
  const data = z.object({
    bankName: z.string().trim().min(2).max(120),
    accountName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().min(4).max(40),
    paybillOrTill: z.string().trim().max(40).optional().or(z.literal('')),
    branchName: z.string().trim().max(120).optional().or(z.literal('')),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  }).parse({
    bankName: formData.get('bankName'),
    accountName: formData.get('accountName'),
    accountNumber: formData.get('accountNumber'),
    paybillOrTill: formData.get('paybillOrTill') || '',
    branchName: formData.get('branchName') || '',
    notes: formData.get('notes') || '',
  })

  await prisma.financeSettingVersion.updateMany({ where: { active: true }, data: { active: false } })
  const version = await prisma.financeSettingVersion.create({
    data: {
      bankName: data.bankName,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      paybillOrTill: data.paybillOrTill || null,
      branchName: data.branchName || null,
      notes: data.notes || null,
      active: true,
      changedById: actor.id,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'FINANCE_DESTINATION_UPDATE',
    entity: 'FinanceSettingVersion',
    entityId: version.id,
    newValue: data,
  })
  refreshFinance()
  revalidatePath('/admin/settings')
  revalidatePath('/contributions')
}

export async function getActiveFinanceDestination() {
  return prisma.financeSettingVersion.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Branch payment summary for a Principal Member's own family branch.
 *
 * The branch is derived from the session, never trusted from the caller: a Principal may only
 * read their own branch, and only Admin/Super Admin may inspect somebody else's.
 */
export async function getBranchContributionSummary(principalId?: string) {
  const viewer = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  const isAdmin = viewer.role === 'ADMIN' || viewer.isSuperAdmin
  const targetId = principalId && isAdmin ? principalId : viewer.id

  if (!isAdmin && !viewer.isPrincipal) {
    throw new Error('Only a Principal Member can view branch payments.')
  }

  const branchWhere = { principalMemberId: targetId }
  // Total comes from an aggregate over the whole branch — a page of recent rows would undercount.
  const [totalAgg, rows] = await Promise.all([
    prisma.contribution.aggregate({
      where: { ...branchWhere, status: { in: ['CONFIRMED', 'RECONCILED'] } },
      _sum: { amount: true },
    }),
    prisma.contribution.findMany({
      where: { ...branchWhere, status: { in: ['CONFIRMED', 'RECONCILED', 'PENDING'] } },
      orderBy: { paidAt: 'desc' },
      take: 100,
      include: {
        user: { select: { fullName: true } },
        transactionCategory: { select: { name: true } },
      },
    }),
  ])

  return {
    total: totalAgg._sum.amount ?? 0,
    rows: rows.map((row) => ({
      id: row.id,
      memberName: row.user.fullName,
      amount: row.amount,
      status: row.status,
      purpose: row.transactionCategory?.name || row.category || '—',
      paidAt: row.paidAt.toISOString(),
    })),
  }
}

export async function updateFundAllocationRule(formData: FormData) {
  const actor = await requireAdmin()
  const emergencyPercent = z.coerce.number().min(0).max(100).parse(formData.get('emergencyPercent'))
  const reservePercent = z.coerce.number().min(0).max(100).parse(formData.get('reservePercent'))
  if (Math.round(emergencyPercent + reservePercent) !== 100) {
    throw new Error('Emergency and reserve percentages must add up to 100.')
  }
  await prisma.fundAllocationRule.updateMany({ where: { active: true }, data: { active: false } })
  const latest = await prisma.fundAllocationRule.findFirst({ orderBy: { version: 'desc' } })
  const rule = await prisma.fundAllocationRule.create({
    data: {
      name: 'Active allocation rule',
      emergencyPercent,
      reservePercent,
      active: true,
      version: (latest?.version || 0) + 1,
      notes: `Updated by ${actor.fullName}`,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'FUND_ALLOCATION_RULE_UPDATE',
    entity: 'FundAllocationRule',
    entityId: rule.id,
    newValue: { emergencyPercent, reservePercent, version: rule.version },
  })
  revalidatePath('/admin/settings')
  return rule
}
