'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { requireLoansEnabled } from '@/lib/feature-flags'
import { getLoanPolicy } from '@/lib/settings'
import { getOpenPeriod, transactionNumber } from '@/lib/finance'
import { sendAnnouncement } from '@/lib/data/queries'
import { sendBroadcastEmail } from '@/lib/email/resend'
import { createServerClient } from '@/lib/supabase-server'

function refreshLoans(loanId?: string) {
  revalidatePath('/dashboard/member/loans')
  revalidatePath('/dashboard/treasurer/loans')
  revalidatePath('/admin/loans')
  revalidatePath('/dashboard/executive/loans')
  revalidatePath('/admin/settings')
  if (loanId) {
    revalidatePath(`/dashboard/treasurer/loans/${loanId}`)
    revalidatePath(`/admin/loans/${loanId}`)
  }
}

async function uploadEvidence(actorId: string, file: File | null) {
  if (!file || !file.size) return null
  if (file.size > 5 * 1024 * 1024) throw new Error('Supporting document must be 5 MB or smaller.')
  const supabase = createServerClient()
  const ext = file.name.split('.').pop() || 'bin'
  const path = `loan-evidence/${actorId}/${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from('documents').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { title: file.name, path, mimeType: file.type || 'application/octet-stream' }
}

export async function submitLoanApplication(formData: FormData) {
  await requireLoansEnabled()
  const actor = await requireActiveRole([
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
    'MEMBER',
  ])
  if (actor.status !== 'ACTIVE') throw new Error('Only active members may apply for loans.')
  const policy = await getLoanPolicy()
  const data = z
    .object({
      amountKes: z.coerce.number().positive(),
      purpose: z.string().trim().min(5).max(2000),
      dueAt: z.coerce.date().optional(),
      installmentNotes: z.string().trim().max(2000).optional(),
      notes: z.string().trim().max(2000).optional(),
    })
    .parse({
      amountKes: formData.get('amountKes'),
      purpose: formData.get('purpose'),
      dueAt: formData.get('dueAt') || undefined,
      installmentNotes: formData.get('installmentNotes') || undefined,
      notes: formData.get('notes') || undefined,
    })
  if (data.amountKes > policy.maxAmountKes) {
    throw new Error(`Amount exceeds maximum loan of KES ${policy.maxAmountKes.toLocaleString()}.`)
  }
  const guarantorIds = [...new Set(formData.getAll('guarantorIds').map(String).filter(Boolean))]
  if (guarantorIds.includes(actor.id)) throw new Error('You cannot guarantee your own loan.')
  if (guarantorIds.length < policy.minGuarantors) {
    throw new Error(`Select at least ${policy.minGuarantors} guarantor(s).`)
  }
  const guarantors = await prisma.user.findMany({
    where: { id: { in: guarantorIds }, status: 'ACTIVE' },
    select: { id: true, email: true, fullName: true },
  })
  if (guarantors.length !== guarantorIds.length) throw new Error('One or more guarantors are invalid.')

  const loan = await prisma.loanApplication.create({
    data: {
      applicantId: actor.id,
      amountKes: data.amountKes,
      purpose: data.purpose,
      dueAt: data.dueAt ?? null,
      installmentNotes: data.installmentNotes ?? null,
      notes: data.notes ?? null,
      status: 'SUBMITTED',
      guarantors: { create: guarantors.map((g) => ({ userId: g.id })) },
    },
  })

  await writeAudit({
    userId: actor.id,
    action: 'LOAN_SUBMIT',
    entity: 'LoanApplication',
    entityId: loan.id,
    newValue: { amountKes: data.amountKes, guarantors: guarantorIds.length },
  })

  const treasurers = await prisma.user.findMany({
    where: { status: 'ACTIVE', OR: [{ role: 'TREASURER' }, { role: 'ADMIN' }, { isSuperAdmin: true }] },
    select: { id: true },
  })
  after(() =>
    sendAnnouncement({
      authorId: actor.id,
      title: `Loan application: ${actor.fullName}`,
      content: `${actor.fullName} requested KES ${data.amountKes.toLocaleString()} — ${data.purpose}`,
      broadcast: false,
      memberIds: treasurers.map((t) => t.id),
    }).catch(console.error),
  )
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  after(() =>
    sendBroadcastEmail({
      subject: `Please guarantee a loan for ${actor.fullName}`,
      title: 'Loan guarantor request',
      body: `<p>${actor.fullName} asked you to guarantee a loan of KES ${data.amountKes.toLocaleString()}.</p><p>${data.purpose}</p>`,
      ctaLabel: 'Respond in dashboard',
      ctaUrl: `${appUrl}/dashboard/member/loans`,
      template: 'loan_guarantor_invite',
      actorId: actor.id,
      memberIds: guarantors.map((g) => g.id),
    }).catch(console.error),
  )

  refreshLoans(loan.id)
}

export async function respondLoanGuarantor(formData: FormData) {
  await requireLoansEnabled()
  const actor = await requireActiveRole([
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
    'MEMBER',
  ])
  const data = z
    .object({
      guarantorId: z.string().min(1),
      status: z.enum(['ACCEPTED', 'DECLINED']),
      note: z.string().trim().max(500).optional(),
    })
    .parse({
      guarantorId: formData.get('guarantorId'),
      status: formData.get('status'),
      note: formData.get('note') || undefined,
    })
  const row = await prisma.loanGuarantor.findUniqueOrThrow({
    where: { id: data.guarantorId },
    include: { loan: true },
  })
  if (row.userId !== actor.id) throw new Error('Not your guarantor invitation.')
  if (row.status !== 'PENDING') throw new Error('Already responded.')
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(row.loan.status)) {
    throw new Error('This loan is no longer awaiting guarantors.')
  }
  await prisma.loanGuarantor.update({
    where: { id: row.id },
    data: { status: data.status, note: data.note ?? null, respondedAt: new Date() },
  })
  await writeAudit({
    userId: actor.id,
    action: 'LOAN_GUARANTOR_RESPOND',
    entity: 'LoanGuarantor',
    entityId: row.id,
    newValue: { status: data.status },
  })
  refreshLoans(row.loanId)
}

export async function treasurerReviewLoan(formData: FormData) {
  await requireLoansEnabled()
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const data = z
    .object({
      loanId: z.string().min(1),
      treasurerNote: z.string().trim().min(2).max(2000),
      markUnderReview: z.enum(['on', 'off']).optional(),
    })
    .parse({
      loanId: formData.get('loanId'),
      treasurerNote: formData.get('treasurerNote'),
      markUnderReview: formData.has('markUnderReview') ? 'on' : 'off',
    })
  const loan = await prisma.loanApplication.findUniqueOrThrow({ where: { id: data.loanId } })
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status)) {
    throw new Error('Loan cannot be reviewed in its current status.')
  }
  await prisma.loanApplication.update({
    where: { id: loan.id },
    data: {
      treasurerNote: data.treasurerNote,
      reviewedById: actor.id,
      reviewedAt: new Date(),
      status: data.markUnderReview === 'on' || loan.status === 'SUBMITTED' ? 'UNDER_REVIEW' : loan.status,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'LOAN_TREASURER_REVIEW',
    entity: 'LoanApplication',
    entityId: loan.id,
    newValue: { treasurerNote: data.treasurerNote },
  })
  refreshLoans(loan.id)
}

export async function decideLoanApplication(formData: FormData) {
  await requireLoansEnabled()
  const actor = await requireAdmin()
  const data = z
    .object({
      loanId: z.string().min(1),
      decision: z.enum(['APPROVED', 'REJECTED']),
      decisionNote: z.string().trim().max(2000).optional(),
    })
    .parse({
      loanId: formData.get('loanId'),
      decision: formData.get('decision'),
      decisionNote: formData.get('decisionNote') || undefined,
    })
  const policy = await getLoanPolicy()
  const loan = await prisma.loanApplication.findUniqueOrThrow({
    where: { id: data.loanId },
    include: { guarantors: true, applicant: true },
  })
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status)) {
    throw new Error('Loan is not awaiting a decision.')
  }
  if (!loan.reviewedAt && actor.role === 'ADMIN' && !actor.isSuperAdmin) {
    // Admin may decide without treasurer note, but prefer under review
  }
  if (data.decision === 'APPROVED' && policy.requireGuarantorAccept) {
    const accepted = loan.guarantors.filter((g) => g.status === 'ACCEPTED').length
    if (accepted < policy.minGuarantors) {
      throw new Error('Not enough guarantors have accepted yet.')
    }
  }
  await prisma.loanApplication.update({
    where: { id: loan.id },
    data: {
      status: data.decision,
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: data.decisionNote ?? null,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: data.decision === 'APPROVED' ? 'LOAN_APPROVE' : 'LOAN_REJECT',
    entity: 'LoanApplication',
    entityId: loan.id,
    newValue: { decision: data.decision, decisionNote: data.decisionNote },
  })
  after(() =>
    sendBroadcastEmail({
      subject: `Loan ${data.decision.toLowerCase()}: ${loan.purpose.slice(0, 40)}`,
      title: `Your loan was ${data.decision.toLowerCase()}`,
      body: `<p>Amount: KES ${Number(loan.amountKes).toLocaleString()}</p><p>${data.decisionNote || ''}</p>`,
      ctaLabel: 'View loans',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard/member/loans`,
      template: 'loan_decision',
      actorId: actor.id,
      memberIds: [loan.applicantId],
    }).catch(console.error),
  )
  refreshLoans(loan.id)
}

export async function recordLoanDisbursement(formData: FormData) {
  await requireLoansEnabled()
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const data = z
    .object({
      loanId: z.string().min(1),
      amount: z.coerce.number().positive(),
      sourceAccountId: z.string().min(1),
      occurredAt: z.coerce.date(),
    })
    .parse({
      loanId: formData.get('loanId'),
      amount: formData.get('amount'),
      sourceAccountId: formData.get('sourceAccountId'),
      occurredAt: formData.get('occurredAt'),
    })
  const loan = await prisma.loanApplication.findUniqueOrThrow({
    where: { id: data.loanId },
    include: { applicant: true, ledgerLinks: { where: { kind: 'DISBURSEMENT' } } },
  })
  if (loan.status !== 'APPROVED') throw new Error('Only approved loans can be disbursed.')
  if (loan.ledgerLinks.length) throw new Error('Loan already has a disbursement recorded.')
  const evidence = await uploadEvidence(actor.id, formData.get('evidence') as File)
  const period = await getOpenPeriod(data.occurredAt)
  const category = await prisma.transactionCategory.findUniqueOrThrow({
    where: { id: 'cat-loan-disbursement' },
  })
  const threshold = Number(
    (await prisma.appSetting.findUnique({ where: { key: 'financial_approval_threshold_kes' } }))?.value ||
      50000,
  )
  const approvalRequired = data.amount >= threshold && actor.role !== 'ADMIN' && !actor.isSuperAdmin

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.financialTransaction.create({
      data: {
        transactionNumber: transactionNumber(),
        type: 'DISBURSEMENT',
        status: approvalRequired ? 'PENDING' : 'CONFIRMED',
        amount: data.amount,
        description: `Loan disbursement to ${loan.applicant.fullName}`,
        occurredAt: data.occurredAt,
        categoryId: category.id,
        periodId: period.id,
        createdById: actor.id,
        approvedById: approvalRequired ? null : actor.id,
        confirmedAt: approvalRequired ? null : new Date(),
        entries: {
          create: [
            { accountId: 'acct-expense', debit: data.amount, credit: 0, memo: loan.purpose },
            {
              accountId: data.sourceAccountId,
              debit: 0,
              credit: data.amount,
              memo: `Loan to ${loan.applicant.fullName}`,
            },
          ],
        },
        disbursement: {
          create: {
            beneficiary: loan.applicant.fullName,
            purpose: loan.purpose,
          },
        },
        ...(evidence
          ? {
              supportingDocuments: {
                create: {
                  title: evidence.title,
                  fileUrl: evidence.path,
                  mimeType: evidence.mimeType,
                  uploadedById: actor.id,
                },
              },
            }
          : {}),
        loanLedgerLinks: {
          create: { loanId: loan.id, kind: 'DISBURSEMENT' },
        },
      },
    })
    if (!approvalRequired) {
      await tx.loanApplication.update({
        where: { id: loan.id },
        data: { status: 'DISBURSED', disbursedAt: new Date() },
      })
    }
    return created
  })

  await writeAudit({
    userId: actor.id,
    action: 'LOAN_DISBURSEMENT_CREATE',
    entity: 'FinancialTransaction',
    entityId: transaction.id,
    meta: { loanId: loan.id, approvalRequired },
  })
  refreshLoans(loan.id)
}

export async function recordLoanRepayment(formData: FormData) {
  await requireLoansEnabled()
  const actor = await requireActiveRole(['TREASURER', 'ADMIN'])
  const data = z
    .object({
      loanId: z.string().min(1),
      amount: z.coerce.number().positive(),
      destinationAccountId: z.string().min(1),
      occurredAt: z.coerce.date(),
      paymentMethod: z.enum(['CASH', 'MPESA', 'BANK', 'OTHER']),
    })
    .parse({
      loanId: formData.get('loanId'),
      amount: formData.get('amount'),
      destinationAccountId: formData.get('destinationAccountId'),
      occurredAt: formData.get('occurredAt'),
      paymentMethod: formData.get('paymentMethod') || 'CASH',
    })
  const loan = await prisma.loanApplication.findUniqueOrThrow({
    where: { id: data.loanId },
    include: { applicant: true },
  })
  if (loan.status !== 'DISBURSED') throw new Error('Repayments require a disbursed loan.')

  const period = await getOpenPeriod(data.occurredAt)
  const category = await prisma.transactionCategory.findUniqueOrThrow({
    where: { id: 'cat-loan-repayment' },
  })

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.financialTransaction.create({
      data: {
        transactionNumber: transactionNumber(),
        type: 'CONTRIBUTION',
        status: 'CONFIRMED',
        amount: data.amount,
        description: `Loan repayment from ${loan.applicant.fullName}`,
        occurredAt: data.occurredAt,
        categoryId: category.id,
        periodId: period.id,
        createdById: actor.id,
        approvedById: actor.id,
        confirmedAt: new Date(),
        entries: {
          create: [
            {
              accountId: data.destinationAccountId,
              debit: data.amount,
              credit: 0,
              memo: `Loan repayment ${loan.id}`,
            },
            { accountId: 'acct-contribution-income', debit: 0, credit: data.amount, memo: loan.purpose },
          ],
        },
        loanLedgerLinks: {
          create: { loanId: loan.id, kind: 'REPAYMENT' },
        },
      },
    })
    return created
  })

  // Close if fully repaid
  const links = await prisma.loanLedgerLink.findMany({
    where: { loanId: loan.id, transaction: { status: { in: ['CONFIRMED', 'RECONCILED'] } } },
    include: { transaction: { select: { amount: true } } },
  })
  let disbursed = 0
  let repaid = 0
  for (const link of links) {
    const n = Number(link.transaction.amount)
    if (link.kind === 'DISBURSEMENT') disbursed += n
    else repaid += n
  }
  if (disbursed > 0 && repaid >= disbursed) {
    await prisma.loanApplication.update({
      where: { id: loan.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
  }

  await writeAudit({
    userId: actor.id,
    action: 'LOAN_REPAYMENT_CREATE',
    entity: 'FinancialTransaction',
    entityId: transaction.id,
    meta: { loanId: loan.id, amount: data.amount, paymentMethod: data.paymentMethod },
  })
  refreshLoans(loan.id)
}
