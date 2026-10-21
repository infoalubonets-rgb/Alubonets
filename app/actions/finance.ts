'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin, requireTreasurer } from '@/lib/auth/session'
import { requireContributionRecorder } from '@/lib/auth/contribution-recorder'
import { canRecordContributionFor } from '@/lib/finance-access'
import {
  compareMonths,
  createLedgerContribution,
  currentAccountingMonth,
  getPeriodForDate,
  manuallyOpenedPeriodId,
  markEditedAfterClose,
  monthsWithData,
  periodFields,
  periodOpenBlocker,
  recomputeStandingSafely,
  refreshObligation,
  runAfterResponse,
  setManuallyOpenedPeriod,
  transactionNumber,
  type MonthRef,
} from '@/lib/finance'
import { getStandingSettings, saveStandingSettings } from '@/lib/membership-standing-settings'
import { syncMembershipStanding } from '@/lib/membership-standing-sync'
import { ANNUAL_DUE_DATE_PATTERN } from '@/lib/membership-standing'
import { writeAudit } from '@/lib/audit'
import { reverseContributions } from '@/lib/contribution-deletion'
import { TAGS } from '@/lib/data/queries'
import { createSignedUpload } from '@/lib/upload-signed'
import { requireWelfareEnabled } from '@/lib/feature-flags'
import { assertNotFuture } from '@/lib/dates'
import { amountKes, amountKesOrZero } from '@/lib/money-limits'
import { notifyUsers } from '@/lib/notifications'
import { otherCategoryDescriptionSchema, paymentDescription, resolvePaymentCategory, uniqueCategoryCode } from '@/lib/payment-categories'
import { NOT_DELETED_MEMBER } from '@/lib/deleted-member'

const refreshFinance = () => {
  for (const path of ['/dashboard/treasurer/finance','/dashboard/treasurer/ledger','/dashboard/treasurer/reports','/contributions','/admin/finance']) revalidatePath(path)
  revalidateTag(TAGS.contributions)
}

/** Opens one month and closes every other; a past month is remembered so auto-close leaves it open. */
async function openAccountingPeriod(actorId: string, target: MonthRef, current: MonthRef) {
  const period = await getPeriodForDate(new Date(Date.UTC(target.year, target.month - 1, 1)))
  const oldStatus = period.status
  await prisma.$transaction(async (tx) => {
    await tx.accountingPeriod.updateMany({
      where: { status: 'OPEN', id: { not: period.id } },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: actorId },
    })
    await tx.accountingPeriod.update({ where: { id: period.id }, data: { status: 'OPEN', closedAt: null, closedBy: null } })
    await setManuallyOpenedPeriod(tx, compareMonths(target, current) < 0 ? period.id : null, actorId)
  })
  return { period, oldStatus }
}

const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pick a valid month.')

export async function toggleAccountingPeriod(formData: FormData) {
  const actor = await requireAdmin()
  const [year, month] = monthParamSchema.parse(formData.get('month')).split('-').map(Number)
  const target = { year, month }
  const current = currentAccountingMonth()
  const existing = await prisma.accountingPeriod.findUnique({ where: { year_month: { year, month } } })

  let periodId: string
  let oldStatus: string
  let nextStatus: 'OPEN' | 'CLOSED'
  if (existing?.status === 'OPEN') {
    nextStatus = 'CLOSED'
    oldStatus = existing.status
    periodId = existing.id
    await prisma.$transaction(async (tx) => {
      await tx.accountingPeriod.update({
        where: { id: existing.id },
        data: { status: 'CLOSED', closedAt: new Date(), closedBy: actor.id },
      })
      if ((await manuallyOpenedPeriodId(tx)) === existing.id) await setManuallyOpenedPeriod(tx, null, actor.id)
    })
  } else {
    // Guard here too: the UI hides the button, but a crafted request must not open a future or empty month.
    const blocker = periodOpenBlocker(target, current, (await monthsWithData(year)).has(month))
    if (blocker) throw new Error(blocker)
    nextStatus = 'OPEN'
    const opened = await openAccountingPeriod(actor.id, target, current)
    periodId = opened.period.id
    oldStatus = existing?.status ?? 'NONE'
  }

  await writeAudit({
    userId: actor.id,
    action: 'ACCOUNTING_PERIOD_STATUS_CHANGE',
    entity: 'AccountingPeriod',
    entityId: periodId,
    oldValue: { status: oldStatus },
    newValue: { status: nextStatus, year, month },
  })
  refreshFinance()
}

/** Leaves an old month and goes back to working in the current one. */
export async function openCurrentAccountingPeriod() {
  const actor = await requireAdmin()
  const current = currentAccountingMonth()
  const { period, oldStatus } = await openAccountingPeriod(actor.id, current, current)
  await writeAudit({
    userId: actor.id,
    action: 'ACCOUNTING_PERIOD_STATUS_CHANGE',
    entity: 'AccountingPeriod',
    entityId: period.id,
    oldValue: { status: oldStatus },
    newValue: { status: 'OPEN', year: current.year, month: current.month },
  })
  refreshFinance()
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
  targetAmount: amountKes('Overall target'),
  perMemberTarget: amountKes('Per-member target').optional(),
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

/**
 * Deletes campaigns and their member targets. Campaigns with recorded payments are skipped so
 * ledger records never lose their campaign link — deactivate those instead.
 */
export async function deleteContributionCampaigns(campaignIds: string[]) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const ids = z.array(z.string().min(1)).min(1).max(200).parse(campaignIds)
  const campaigns = await prisma.contributionCampaign.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, _count: { select: { contributions: true } } },
  })
  const deletable = campaigns.filter((campaign) => campaign._count.contributions === 0)
  const skipped = campaigns.filter((campaign) => campaign._count.contributions > 0).map((campaign) => campaign.title)

  if (deletable.length) {
    await prisma.contributionCampaign.deleteMany({ where: { id: { in: deletable.map((campaign) => campaign.id) } } })
    for (const campaign of deletable) {
      await writeAudit({
        userId: actor.id,
        action: 'CONTRIBUTION_CAMPAIGN_DELETE',
        entity: 'ContributionCampaign',
        entityId: campaign.id,
        oldValue: { title: campaign.title },
      })
    }
  }
  refreshCampaigns()
  return { deleted: deletable.length, skipped }
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
  const actor = await requireContributionRecorder()
  if (!canRecordContributionFor(actor, String(formData.get('userId') || ''))) throw new Error('Super Admin cannot record their own contribution.')
  const raw = {
    userId: formData.get('userId'),
    amount: formData.get('amount'),
    description: formData.get('description') || undefined,
    categoryId: formData.get('categoryId'),
    otherCategoryDescription: formData.get('otherCategoryDescription') || undefined,
    campaignId: formData.get('campaignId') || undefined,
    projectId: formData.get('projectId') || undefined,
    contributionPeriod: formData.get('contributionPeriod') || undefined,
    sourceAccountId: formData.get('sourceAccountId'),
    paymentMethod: formData.get('paymentMethod'),
    providerReference: formData.get('providerReference') || undefined,
    occurredAt: formData.get('occurredAt'),
  }
  const data = z.object({
    userId: z.string({ invalid_type_error: 'Select the member.' }).min(1, 'Select the member.'),
    amount: amountKes(),
    description: z.string().trim().max(500, 'Note is too long (500 characters max).').optional(),
    categoryId: z.string().default(''),
    otherCategoryDescription: z.string().trim().max(500).optional(),
    campaignId: z.string().optional(),
    projectId: z.string().optional(),
    contributionPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose the month this payment covers.').optional(),
    sourceAccountId: z.string({ invalid_type_error: 'Choose the receiving account.' }).min(1, 'Choose the receiving account.'),
    paymentMethod: z.enum(['CASH','MPESA','BANK','OTHER'], { errorMap: () => ({ message: 'Choose the payment method.' }) }),
    providerReference: z.string().trim().max(100, 'Transaction reference is too long (100 characters max).').optional(),
    occurredAt: z.coerce.date({ errorMap: () => ({ message: 'Enter the date paid.' }) }),
  }).parse(raw)
  const { categoryId, otherLabel } = await resolvePaymentCategory({
    categoryId: data.categoryId,
    otherCategoryDescription: data.otherCategoryDescription,
    actorId: actor.id,
    projectId: data.projectId,
    campaignId: data.campaignId,
  })
  if (otherLabel) {
    otherCategoryDescriptionSchema.parse(data.otherCategoryDescription)
  }
  const description = paymentDescription(data.description?.trim() || 'Member contribution', otherLabel)
  assertNotFuture(data.occurredAt, 'Contribution date')
  const evidence = formData.get('evidencePath') ? z.object({
    evidencePath: z.string().min(1),
    evidenceMimeType: z.enum(['application/pdf', 'image/png', 'image/webp', 'image/jpeg']),
    evidenceTitle: z.string().regex(/\.(pdf|png|webp|jpe?g)$/i, 'Unsupported proof file type.'),
  }).parse({
    evidencePath: formData.get('evidencePath'),
    evidenceMimeType: formData.get('evidenceMimeType'),
    evidenceTitle: formData.get('evidenceTitle'),
  }) : null
  // Incoming contributions are never held by the expense approval limit.
  const status = 'CONFIRMED'
  const result = await createLedgerContribution({
    ...data,
    categoryId,
    description,
    receivedBy: actor.fullName,
    actorId: actor.id,
    status,
    proofPath: evidence?.evidencePath,
    proofMimeType: evidence?.evidenceMimeType,
    proofTitle: evidence?.evidenceTitle,
  })
  // The payment is saved; the audit entry is written just after the response.
  runAfterResponse(() => writeAudit({ userId: actor.id, action: 'LEDGER_CONTRIBUTION_CREATE', entity: 'FinancialTransaction', entityId: result.financial.id, meta: { contributionId: result.contribution.id, status, ...data } }))
  refreshFinance()
}

/** Step 1 of a fast upload: authorize, then hand back a signed URL for a direct browser→Supabase upload. */
export async function requestEvidenceUploadUrl(formData: FormData) {
  const actor = await requireContributionRecorder()
  const fileName = z.string().min(1).parse(formData.get('fileName'))
  if (!/\.(pdf|png|webp|jpe?g)$/i.test(fileName)) throw new Error('Upload a PDF, PNG, WebP, JPEG or JPG file.')
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${actor.id}/${Date.now()}-${crypto.randomUUID()}-${safe}`
  return createSignedUpload('financial-documents', path)
}

export async function recordExpense(formData: FormData) {
  const actor = await requireTreasurer()
  const data = z.object({
    amount: amountKes(),
    description: z.string().trim().max(500).optional(),
    otherCategoryDescription: z.string().trim().max(500).optional(),
    // Payee is no longer asked for; the purpose (or the Other explanation) describes the expense.
    payee: z.string().trim().max(160).optional().default(''),
    categoryId: z.string().min(1, 'Choose the purpose of this expense.'),
    projectId: z.string().optional().transform((value) => value || undefined),
    sourceAccountId: z.string().min(1, 'Choose the account it was paid from.'),
    occurredAt: z.coerce.date({ errorMap: () => ({ message: 'Enter the date paid.' }) }),
  }).parse(Object.fromEntries(formData))
  const { categoryId, otherLabel } = await resolvePaymentCategory({
    categoryId: data.categoryId,
    otherCategoryDescription: data.otherCategoryDescription,
    actorId: actor.id,
    projectId: data.projectId,
  })
  if (otherLabel) otherCategoryDescriptionSchema.parse(data.otherCategoryDescription)
  const purposeName = otherLabel
    ? data.otherCategoryDescription!.trim()
    : (await prisma.transactionCategory.findUnique({ where: { id: categoryId }, select: { name: true } }))?.name ?? 'Expense'
  const purpose = data.description?.trim() || purposeName
  const description = paymentDescription(purpose, otherLabel)
  assertNotFuture(data.occurredAt, 'Expense date')
  // Supporting document is optional.
  const evidence = formData.get('evidencePath')
    ? z.object({
        evidencePath: z.string().min(1),
        evidenceMimeType: z.string().min(1),
        evidenceTitle: z.string().min(1),
      }).parse({
        evidencePath: formData.get('evidencePath'),
        evidenceMimeType: formData.get('evidenceMimeType'),
        evidenceTitle: formData.get('evidenceTitle'),
      })
    : null
  const threshold = Number((await prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }))?.value || 50000)
  // Guide: Admin must not bypass finance approval merely because of system role.
  const approvalRequired = data.amount > threshold
  const period = await getPeriodForDate(data.occurredAt)
  const transaction = await prisma.financialTransaction.create({
    data: {
      transactionNumber: transactionNumber(), type: 'EXPENSE', status: approvalRequired ? 'PENDING' : 'CONFIRMED', amount: data.amount, description, occurredAt: data.occurredAt, categoryId, ...periodFields(period), createdById: actor.id, approvedById: approvalRequired ? null : actor.id, confirmedAt: approvalRequired ? null : new Date(),
      entries: { create: [{ accountId: 'acct-expense', debit: data.amount, credit: 0, memo: purpose }, { accountId: data.sourceAccountId, debit: 0, credit: data.amount, memo: data.payee ? `Paid to ${data.payee}` : purpose }] },
      expense: { create: { payee: data.payee, purpose, approvalRequired, projectId: data.projectId ?? null } },
      ...(evidence
        ? { supportingDocuments: { create: { title: evidence.evidenceTitle, fileUrl: evidence.evidencePath, mimeType: evidence.evidenceMimeType, uploadedById: actor.id } } }
        : {}),
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
  const actor = await requireTreasurer()
  const data = z.object({
    welfareRequestId: z.string().min(1),
    amount: amountKes(),
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
  const period = await getPeriodForDate(data.occurredAt)
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
        ...periodFields(period),
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
    await markEditedAfterClose(id, tx)
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
  const actor = await requireTreasurer()
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  const original = await prisma.financialTransaction.findUniqueOrThrow({ where: { id }, include: { entries: true } })
  if (!['CONFIRMED','RECONCILED'].includes(original.status)) throw new Error('Only confirmed or reconciled transactions can be reversed.')
  const reversal = await prisma.financialTransaction.create({
    data: { transactionNumber: transactionNumber(), type: 'REVERSAL', status: 'PENDING', amount: original.amount, description: `Reversal of ${original.transactionNumber}`, occurredAt: new Date(), correctionReason: reason, ...periodFields(await getPeriodForDate(new Date())), createdById: actor.id, originalTransactionId: original.id, entries: { create: original.entries.map((entry) => ({ accountId: entry.accountId, debit: entry.credit, credit: entry.debit, memo: reason })) }, adjustment: { create: { reason, oldValue: { status: original.status }, newValue: { requestedStatus: 'REVERSED' } } } },
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
    markEditedAfterClose(reversal.originalTransactionId),
    prisma.contribution.updateMany({ where: { financialTransactionId: reversal.originalTransactionId }, data: { status: 'REVERSED', correctionReason: reversal.correctionReason } }),
  ])
  const reversedContribution = await prisma.contribution.findUnique({ where: { financialTransactionId: reversal.originalTransactionId }, select: { userId: true } })
  if (reversedContribution) await recomputeStandingSafely(reversedContribution.userId, actor.id)
  await writeAudit({ userId: actor.id, action: 'REVERSAL_APPROVE', entity: 'FinancialTransaction', entityId: id, reason: reversal.correctionReason || 'Reversal approved', oldValue: { status: reversal.status }, newValue: { status: 'CONFIRMED', originalId: reversal.originalTransactionId }, meta: { originalId: reversal.originalTransactionId } })
  refreshFinance()
}

export async function reconcilePaymentEvent(formData: FormData) {
  const actor = await requireTreasurer()
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
    campaignId: data.campaignId,
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
  const period = await getPeriodForDate(event.receivedAt)
  await prisma.$transaction([
    prisma.paymentEvent.update({ where: { id: event.id }, data: { status: 'MATCHED', matchedUserId: data.userId, matchedContributionId: result.contribution.id } }),
    prisma.reconciliation.create({ data: { transactionId: result.financial.id, paymentEventId: event.id, periodId: period.id, notes: data.notes, reconciledById: actor.id } }),
    prisma.financialTransaction.update({ where: { id: result.financial.id }, data: { reconciledAt: new Date() } }),
  ])
  await writeAudit({ userId: actor.id, action: 'PAYMENT_RECONCILE', entity: 'PaymentEvent', entityId: event.id, meta: { ...data, contributionId: result.contribution.id } })
  refreshFinance()
}

/** Marks a confirmed payment as matched to the bank / M-Pesa statement. */
export async function getReconciliationMembers() {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  return prisma.user.findMany({
    where: { ...NOT_DELETED_MEMBER, ...(canRecordContributionFor(actor, actor.id) ? {} : { id: { not: actor.id } }) },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  })
}

export async function reconcileContribution(formData: FormData) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const data = z.object({
    id: z.string().min(1),
    memberId: z.string().min(1).optional(),
    statementRef: z.string().trim().max(120).optional(),
    notes: z.string().trim().min(5, 'Add a short reconciliation note (at least 5 characters).').max(1000),
  }).parse({
    id: formData.get('id'),
    memberId: formData.get('memberId') || undefined,
    statementRef: formData.get('statementRef') || undefined,
    notes: formData.get('notes'),
  })
  const contribution = await prisma.contribution.findUniqueOrThrow({
    where: { id: data.id },
    include: { user: { select: { id: true, fullName: true, email: true } }, financialTransaction: { select: { id: true, periodId: true, period: { select: { status: true } }, reconciliation: { select: { id: true } } } } },
  })
  if (!['CONFIRMED', 'RECONCILED'].includes(contribution.status)) throw new Error('Only confirmed or reconciled payments can be reconciled.')
  const memberId = data.memberId || contribution.userId
  const changedMember = memberId !== contribution.userId
  if (changedMember && !canRecordContributionFor(actor, memberId)) throw new Error('You cannot assign this payment to this member.')
  const member = await prisma.user.findUnique({ where: { id: memberId }, select: { id: true, fullName: true, email: true, isPrincipal: true, principalMemberId: true } })
  if (!member) throw new Error('Select an existing member email.')
  const transaction = contribution.financialTransaction
  const now = new Date()
  await prisma.$transaction(async tx => {
    const updated = await tx.contribution.updateMany({ where: { id: contribution.id, userId: contribution.userId, status: contribution.status }, data: {
      userId: memberId, ...(changedMember ? { principalMemberId: member.isPrincipal ? member.id : member.principalMemberId } : {}), status: 'RECONCILED', reconciliationStatus: 'RECONCILED', reconciledAt: now,
      ...(data.statementRef ? { statementRef: data.statementRef } : {}),
    } })
    if (updated.count !== 1) throw new Error('This payment changed. Refresh and try again.')
    if (transaction) {
      await tx.financialTransaction.update({ where: { id: transaction.id }, data: { status: 'RECONCILED', reconciledAt: now, ...(transaction.period?.status === 'CLOSED' ? { editedAfterClose: true } : {}) } })
      await tx.reconciliation.upsert({ where: { transactionId: transaction.id }, create: { transactionId: transaction.id, periodId: transaction.periodId, notes: data.notes, reconciledById: actor.id }, update: { notes: data.notes, reconciledById: actor.id, reconciledAt: now } })
    }
    if (changedMember && contribution.campaignId) {
      await refreshObligation(contribution.campaignId, contribution.userId, tx)
      await refreshObligation(contribution.campaignId, memberId, tx)
    }
    await tx.auditLog.create({ data: { userId: actor.id, actorRole: actor.role, actingRole: actor.role, actorSecondaryRoles: actor.dashboardAccess || [], action: changedMember ? 'CONTRIBUTION_MEMBER_REASSIGN' : 'CONTRIBUTION_RECONCILE', entity: 'Contribution', entityId: contribution.id, reason: data.notes,
      oldValue: { status: contribution.status, memberId: contribution.userId, email: contribution.user.email, name: contribution.user.fullName, statementRef: contribution.statementRef },
      newValue: { status: 'RECONCILED', memberId, email: member.email, name: member.fullName, statementRef: data.statementRef ?? contribution.statementRef },
      meta: { transactionId: transaction?.id ?? null, amount: contribution.amount },
    } })
  })
  if (changedMember) {
    await recomputeStandingSafely(contribution.userId, actor.id)
    await recomputeStandingSafely(memberId, actor.id)
  }
  refreshFinance()
}



export async function updateApprovalThreshold(formData: FormData): Promise<{ ok: true; amount: number }> {
  try {
    const actor = await requireAdmin()
    const amount = amountKes('Approval threshold').parse(formData.get('amount'))
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
      monthlyFeeKes: amountKesOrZero('Monthly fee'),
      monthlyGraceDays: z.coerce.number().int().min(1, 'Pick a monthly deadline day from 1 to 28.').max(28, 'Pick a monthly deadline day from 1 to 28.'),
      annualFeeKes: amountKesOrZero('Annual fee'),
      annualRenewalDays: z.coerce.number().int().min(0).max(365),
      annualDueDate: z.string().regex(ANNUAL_DUE_DATE_PATTERN).nullable(),
      effectiveFrom: z.coerce.date(),
    }).parse({
      monthlyFeeKes: formData.get('monthlyFeeKes') || 0,
      monthlyGraceDays: formData.get('monthlyGraceDays'),
      annualFeeKes: formData.get('annualFeeKes') || 0,
      annualRenewalDays: formData.get('annualRenewalDays') ?? previous.annualRenewalDays,
      annualDueDate: String(formData.get('annualDueDate') ?? '') || previous.annualDueDate,
      effectiveFrom: previous.effectiveFrom,
    })
    const next = data
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
    revalidatePath('/directory')
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
          markEditedAfterClose(contribution.financialTransactionId),
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
  const optional = (max: number) => z.string().trim().max(max)
  const data = z.object({
    bankName: optional(120),
    accountName: optional(120),
    accountNumber: optional(40),
    paybillOrTill: optional(40),
    branchName: optional(120),
    mpesaType: z.enum(['TILL', 'PAYBILL', '']),
    mpesaNumber: z.string().trim().regex(/^\d{0,12}$/, 'M-Pesa number must be digits only'),
    mpesaAccount: optional(60),
    mpesaName: optional(120),
    notes: optional(500),
  }).parse({
    bankName: formData.get('bankName') || '',
    accountName: formData.get('accountName') || '',
    accountNumber: formData.get('accountNumber') || '',
    paybillOrTill: formData.get('paybillOrTill') || '',
    branchName: formData.get('branchName') || '',
    mpesaType: formData.get('mpesaType') || '',
    mpesaNumber: formData.get('mpesaNumber') || '',
    mpesaAccount: formData.get('mpesaAccount') || '',
    mpesaName: formData.get('mpesaName') || '',
    notes: formData.get('notes') || '',
  })

  const anyBank = Boolean(data.bankName || data.accountName || data.accountNumber || data.paybillOrTill || data.branchName)
  const hasBank = Boolean(data.bankName && data.accountName && data.accountNumber)
  if (anyBank && !hasBank) throw new Error('Bank details need a bank name, account name and account number.')
  if (hasBank && data.accountNumber.length < 4) throw new Error('Account number looks too short.')
  const hasMpesa = Boolean(data.mpesaNumber)
  if (hasMpesa && !data.mpesaType) throw new Error('Choose whether the M-Pesa number is a Till or a Paybill.')
  if (hasMpesa && data.mpesaNumber.length < 5) throw new Error('M-Pesa number looks too short.')
  if (!hasBank && !hasMpesa) throw new Error('Add bank details, an M-Pesa Till/Paybill, or both.')
  const isPaybill = hasMpesa && data.mpesaType === 'PAYBILL'

  await prisma.financeSettingVersion.updateMany({ where: { active: true }, data: { active: false } })
  const version = await prisma.financeSettingVersion.create({
    data: {
      bankName: hasBank ? data.bankName : '',
      accountName: hasBank ? data.accountName : '',
      accountNumber: hasBank ? data.accountNumber : '',
      paybillOrTill: (hasBank && data.paybillOrTill) || null,
      branchName: (hasBank && data.branchName) || null,
      mpesaType: hasMpesa ? data.mpesaType : null,
      mpesaNumber: hasMpesa ? data.mpesaNumber : null,
      mpesaAccount: (isPaybill && data.mpesaAccount) || null,
      mpesaName: (hasMpesa && data.mpesaName) || null,
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

const editContributionAmountSchema = z.object({
  id: z.string().min(1),
  amount: amountKes('New amount'),
  reason: z.string().trim().min(5, 'Give a reason of at least 5 characters.').max(500),
})

/**
 * Treasurer-only: corrects the amount of a recorded payment. The contribution, its ledger
 * transaction and both ledger entries change together so balances stay correct, and the
 * old and new amounts go to the audit log with the reason.
 */
export async function editContributionAmount(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireTreasurer()
    const data = editContributionAmountSchema.parse({
      id: formData.get('id'),
      amount: formData.get('amount'),
      reason: formData.get('reason'),
    })
    const newAmount = Number(data.amount.toFixed(2))
    const contribution = await prisma.contribution.findUnique({
      where: { id: data.id },
      include: { user: { select: { fullName: true } } },
    })
    if (!contribution) return { ok: false, error: 'This payment no longer exists.' }
    if (contribution.status === 'REVERSED' || contribution.status === 'REJECTED') {
      return { ok: false, error: 'Reversed or rejected payments cannot be edited.' }
    }
    const oldAmount = Number(contribution.amount)
    if (oldAmount === newAmount) return { ok: false, error: 'The new amount is the same as the current one.' }

    // Ledger rows are locked by the database once posted, so a correction never edits them:
    // the old entry is reversed and a fresh entry is posted for the right amount.
    const original = contribution.financialTransactionId
      ? await prisma.financialTransaction.findUnique({ where: { id: contribution.financialTransactionId }, include: { entries: true } })
      : null
    if (original && !['CONFIRMED', 'RECONCILED', 'PENDING'].includes(original.status)) {
      return { ok: false, error: 'This payment has already been reversed or rejected in the ledger.' }
    }
    const period = original ? await getPeriodForDate(original.occurredAt) : null
    const correction = `Amount corrected from KES ${oldAmount.toLocaleString()} to KES ${newAmount.toLocaleString()}: ${data.reason}`
    const splits = {
      ...(contribution.emergencyPercent != null
        ? { emergencyAmount: Number(((newAmount * contribution.emergencyPercent) / 100).toFixed(2)) }
        : {}),
      ...(contribution.reservePercent != null
        ? { reserveAmount: Number(((newAmount * contribution.reservePercent) / 100).toFixed(2)) }
        : {}),
    }
    await prisma.$transaction(async (tx) => {
      let replacementId: string | null = null
      if (original && period) {
        const posted = original.status !== 'PENDING'
        if (posted) {
          // Confirmed reversal of the old entry: it and the original cancel out in the books.
          await tx.financialTransaction.create({
            data: {
              transactionNumber: transactionNumber(),
              type: 'REVERSAL',
              status: 'CONFIRMED',
              amount: original.amount,
              description: `Reversal of ${original.transactionNumber} (amount correction)`,
              occurredAt: original.occurredAt,
              correctionReason: correction,
              ...periodFields(period),
              createdById: actor.id,
              approvedById: actor.id,
              confirmedAt: new Date(),
              originalTransactionId: original.id,
              entries: { create: original.entries.map((entry) => ({ accountId: entry.accountId, debit: entry.credit, credit: entry.debit, memo: correction })) },
            },
          })
        }
        await tx.financialTransaction.update({
          where: { id: original.id },
          data: posted ? { status: 'REVERSED', reversedAt: new Date(), correctionReason: correction } : { status: 'REJECTED', correctionReason: correction },
        })
        await markEditedAfterClose(original.id, tx)
        const replacement = await tx.financialTransaction.create({
          data: {
            transactionNumber: transactionNumber(),
            type: original.type,
            status: original.status === 'RECONCILED' ? 'CONFIRMED' : original.status,
            amount: newAmount,
            description: original.description,
            occurredAt: original.occurredAt,
            categoryId: original.categoryId,
            correctionReason: correction,
            ...periodFields(period),
            createdById: original.createdById,
            approvedById: posted ? actor.id : null,
            confirmedAt: posted ? new Date() : null,
            entries: {
              create: original.entries.map((entry) => ({
                accountId: entry.accountId,
                debit: Number(entry.debit) > 0 ? newAmount : 0,
                credit: Number(entry.credit) > 0 ? newAmount : 0,
                memo: entry.memo,
              })),
            },
          },
        })
        replacementId = replacement.id
      }
      await tx.contribution.update({
        where: { id: contribution.id },
        data: {
          amount: newAmount,
          ...splits,
          correctionReason: correction,
          ...(replacementId ? { financialTransactionId: replacementId } : {}),
          ...(original?.status === 'RECONCILED' ? { status: 'CONFIRMED', reconciliationStatus: 'UNRECONCILED' } : {}),
        },
      })
      if (contribution.campaignId) await refreshObligation(contribution.campaignId, contribution.userId, tx)
    })

    await writeAudit({
      userId: actor.id,
      action: 'CONTRIBUTION_AMOUNT_EDIT',
      entity: 'Contribution',
      entityId: contribution.id,
      reason: data.reason,
      oldValue: { amount: oldAmount },
      newValue: { amount: newAmount },
      meta: { memberName: contribution.user.fullName, category: contribution.category },
    })
    if (contribution.status === 'CONFIRMED' || contribution.status === 'RECONCILED') {
      await recomputeStandingSafely(contribution.userId, actor.id)
    }
    if (contribution.projectId) {
      const { syncProjectFinancials } = await import('@/lib/project-status')
      await syncProjectFinancials(contribution.projectId).catch(() => {})
    }
    refreshFinance()
    revalidateTag(TAGS.contributions)
    return { ok: true }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message || 'Check the amount and reason.' }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not change the amount.' }
  }
}

const deleteContributionsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Pick at least one payment.').max(5000, 'Delete at most 5,000 payments at a time.'),
  reason: z.string().trim().min(3, 'Give a short reason (at least 3 characters).').max(500),
})

/**
 * Treasurer / Super Admin: deletes recorded payments, one or many. Posted payments are reversed in
 * the ledger, pending ones rejected, and each deletion is audited (see lib/contribution-deletion).
 */
export async function deleteContributions(input: z.input<typeof deleteContributionsSchema>): Promise<{ ok: true; deleted: number; skipped: number } | { ok: false; error: string }> {
  try {
    const actor = await requireContributionRecorder()
    const data = deleteContributionsSchema.parse(input)
    const ids = [...new Set(data.ids)]
    const deleted = await reverseContributions(actor.id, ids, data.reason)
    refreshFinance()
    return { ok: true, deleted, skipped: ids.length - deleted }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message || 'Check the selection and reason.' }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the payments.' }
  }
}

/** Treasurer / Super Admin: deletes every recorded payment of the chosen members (same rules as above). */
export async function deleteMembersContributions(input: { memberIds: string[]; reason: string }): Promise<{ ok: true; deleted: number; skipped: number } | { ok: false; error: string }> {
  try {
    await requireContributionRecorder()
    const memberIds = z.array(z.string().min(1)).min(1, 'Pick at least one member.').max(500).parse(input.memberIds)
    const rows = await prisma.contribution.findMany({ where: { userId: { in: memberIds }, status: { not: 'REVERSED' } }, select: { id: true } })
    if (rows.length === 0) return { ok: false, error: 'The selected members have no payments to delete.' }
    return await deleteContributions({ ids: rows.map((row) => row.id), reason: input.reason })
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message || 'Check the selection.' }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the payments.' }
  }
}

const contributionPlanSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(['MONTHLY', 'ANNUAL']).nullable(),
})

/**
 * Treasurer / Admin: marks whether a member pays monthly or annually. Standing then checks only
 * the matching dues (monthly fees or the annual contribution). Audited; standing updates at once.
 */
export async function setContributionPlan(input: z.input<typeof contributionPlanSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireActiveRole(['TREASURER'])
    const data = contributionPlanSchema.parse(input)
    const member = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true, fullName: true, contributionPlan: true } })
    if (!member) return { ok: false, error: 'Member not found.' }
    if (member.contributionPlan === data.plan) return { ok: true }
    await prisma.user.update({ where: { id: member.id }, data: { contributionPlan: data.plan } })
    await writeAudit({
      userId: actor.id,
      action: 'MEMBER_CONTRIBUTION_PLAN',
      entity: 'User',
      entityId: member.id,
      oldValue: { contributionPlan: member.contributionPlan },
      newValue: { contributionPlan: data.plan },
      meta: { memberName: member.fullName },
    })
    await recomputeStandingSafely(member.id, actor.id)
    refreshFinance()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not change the plan.' }
  }
}


/**
 * Treasurer-only: sends a confirmed transaction back to Pending so it must be approved again.
 * While pending it no longer counts in balances or a member's standing. Reconciled entries,
 * reversals and loan or welfare payouts stay as they are, because other records depend on them.
 */
export async function returnTransactionToPending(formData: FormData) {
  const actor = await requireTreasurer()
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().max(500).optional().parse(formData.get('reason') || undefined)
  const transaction = await prisma.financialTransaction.findUniqueOrThrow({
    where: { id },
    include: { loanLedgerLinks: { select: { id: true } }, disbursement: { select: { welfareRequestId: true } } },
  })
  if (transaction.status !== 'CONFIRMED') throw new Error('Only approved (confirmed) transactions can be sent back to pending.')
  if (transaction.type === 'REVERSAL') throw new Error('Reversals cannot be sent back to pending.')
  if (transaction.loanLedgerLinks.length || transaction.disbursement?.welfareRequestId) {
    throw new Error('Loan and welfare payments cannot be sent back to pending; reverse them instead.')
  }
  const linked = await prisma.$transaction(async (tx) => {
    await tx.financialTransaction.update({ where: { id }, data: { status: 'PENDING', approvedById: null, confirmedAt: null } })
    await markEditedAfterClose(id, tx)
    const contribution = await tx.contribution.findUnique({ where: { financialTransactionId: id } })
    if (contribution && contribution.status === 'CONFIRMED') {
      await tx.contribution.update({ where: { id: contribution.id }, data: { status: 'PENDING', verifiedAt: null, verifiedById: null } })
      if (contribution.campaignId) await refreshObligation(contribution.campaignId, contribution.userId, tx)
    }
    return contribution
  })
  if (linked) await recomputeStandingSafely(linked.userId, actor.id)
  if (linked?.projectId) {
    const { syncProjectFinancials } = await import('@/lib/project-status')
    await syncProjectFinancials(linked.projectId).catch(() => {})
  }
  await writeAudit({
    userId: actor.id,
    action: 'FINANCIAL_TRANSACTION_UNAPPROVE',
    entity: 'FinancialTransaction',
    entityId: id,
    reason: reason || 'Sent back to pending through the status dropdown',
    oldValue: { status: 'CONFIRMED', approvedById: transaction.approvedById },
    newValue: { status: 'PENDING' },
    meta: { transactionNumber: transaction.transactionNumber, amount: Number(transaction.amount) },
  })
  refreshFinance()
}
