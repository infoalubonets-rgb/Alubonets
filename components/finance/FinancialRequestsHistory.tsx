import { prisma } from '@/lib/prisma'
import { APP_TIMEZONE, appTodayInputValue } from '@/lib/dates'
import { requireActiveRole } from '@/lib/auth/session'
import { canRecordPayments } from '@/lib/finance-access'
import { FEATURE_FLAGS, getFeatureFlags } from '@/lib/feature-flags'
import FinancialRequestsBoard, { type RequestItem } from '@/components/finance/FinancialRequestsBoard'

const DAY_MS = 24 * 60 * 60 * 1000
/** Welfare has no due date; a request still open after this many days is flagged overdue. */
const WELFARE_OVERDUE_DAYS = 14

const when = (value: Date | null | undefined) =>
  value ? value.toLocaleString('en-GB', { timeZone: APP_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
const day = (value: Date | null | undefined) =>
  value ? value.toLocaleDateString('en-GB', { timeZone: APP_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' }) : null

/**
 * Loan and welfare requests with everything needed to review them: guarantors, decisions,
 * payments and the audit trail. Request decisions are history; only payments move money.
 */
export default async function FinancialRequestsHistory() {
  const actor = await requireActiveRole(['TREASURER'])
  const now = new Date()
  const [flags, loans, welfare, trail, accounts] = await Promise.all([
    getFeatureFlags(),
    prisma.loanApplication.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        applicant: { select: { fullName: true, email: true, phone: true, membershipNumber: true } },
        reviewedBy: { select: { fullName: true } },
        decidedBy: { select: { fullName: true } },
        guarantors: { include: { user: { select: { fullName: true, phone: true } } } },
        ledgerLinks: { include: { transaction: { include: { createdBy: { select: { fullName: true } }, approvedBy: { select: { fullName: true } } } } } },
      },
    }),
    prisma.welfareRequest.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true, phone: true, membershipNumber: true } },
        category: true,
        treasurerApprovedBy: { select: { fullName: true } },
        executiveApprovedBy: { select: { fullName: true } },
        decisions: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { fullName: true } } } },
      },
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ entity: { in: ['LoanApplication', 'LoanGuarantor', 'WelfareRequest'] } }, { action: { startsWith: 'LOAN_' } }, { action: { startsWith: 'WELFARE_' } }] },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.financialAccount.findMany({ where: { active: true, type: 'ASSET' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const welfarePayments = welfare.length
    ? await prisma.disbursement.findMany({
        where: { welfareRequestId: { in: welfare.map((r) => r.id) } },
        include: { transaction: { include: { createdBy: { select: { fullName: true } }, approvedBy: { select: { fullName: true } } } } },
      })
    : []

  const loansOn = Boolean(flags[FEATURE_FLAGS.loansEnabled])
  const welfareOn = Boolean(flags[FEATURE_FLAGS.welfareEnabled])
  const isAdmin = actor.role === 'ADMIN' || Boolean(actor.isSuperAdmin)
  const isTreasurer = canRecordPayments(actor)
  const reviewsWelfare = isAdmin || actor.role === 'TREASURER' || actor.role === 'EXECUTIVE'

  const trailFor = (entityId: string) =>
    trail
      .filter((event) => event.entityId === entityId || (event.meta as { loanId?: string } | null)?.loanId === entityId)
      .map((event) => ({ id: event.id, at: when(event.createdAt)!, who: event.user?.fullName || 'System', action: event.action, reason: event.reason }))

  const paymentRow = (tx: (typeof welfarePayments)[number]['transaction']) => ({
    id: tx.id,
    label: tx.type === 'DISBURSEMENT' ? 'Paid out' : 'Repayment',
    status: tx.status,
    amount: Number(tx.amount),
    at: day(tx.occurredAt)!,
    by: `${tx.createdBy.fullName}${tx.approvedBy ? `, approved by ${tx.approvedBy.fullName}` : ''}`,
  })

  const items: RequestItem[] = [
    ...loans.map((loan): RequestItem => {
      const open = !['CLOSED', 'REJECTED', 'DRAFT'].includes(loan.status)
      const overdue = Boolean(loan.dueAt && loan.dueAt < now && open)
      const repaid = loan.ledgerLinks.filter((l) => l.kind === 'REPAYMENT' && ['CONFIRMED', 'RECONCILED'].includes(l.transaction.status)).reduce((s, l) => s + Number(l.transaction.amount), 0)
      const pending = ['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status)
      return {
        id: loan.id,
        kind: 'LOAN',
        person: loan.applicant.fullName,
        amount: Number(loan.amountKes),
        status: loan.status,
        submittedAt: day(loan.createdAt)!,
        dueLabel: loan.dueAt ? `Due ${day(loan.dueAt)}` : null,
        overdue,
        overdueLabel: overdue ? `Overdue by ${Math.max(1, Math.floor((now.getTime() - loan.dueAt!.getTime()) / DAY_MS))} days` : null,
        summary: loan.purpose,
        details: [
          { label: 'Applicant', value: `${loan.applicant.fullName}${loan.applicant.membershipNumber ? ` (${loan.applicant.membershipNumber})` : ''}` },
          { label: 'Contact', value: [loan.applicant.email, loan.applicant.phone].filter(Boolean).join(' · ') },
          { label: 'Amount requested', value: `KES ${Number(loan.amountKes).toLocaleString()}` },
          { label: 'Purpose', value: loan.purpose },
          { label: 'Submitted', value: when(loan.createdAt)! },
          { label: 'Due date', value: day(loan.dueAt) ?? 'Not set' },
          { label: 'Instalments', value: loan.installmentNotes || '—' },
          { label: 'Notes', value: loan.notes || '—' },
          { label: 'Treasurer review', value: loan.reviewedBy ? `${loan.reviewedBy.fullName} · ${when(loan.reviewedAt)} · ${loan.treasurerNote || ''}` : 'Not reviewed yet' },
          { label: 'Decision', value: loan.decidedBy ? `${loan.decidedBy.fullName} · ${when(loan.decidedAt)} · ${loan.decisionNote || ''}` : 'No decision yet' },
          { label: 'Disbursed', value: when(loan.disbursedAt) ?? '—' },
          { label: 'Repaid so far', value: `KES ${repaid.toLocaleString()}` },
          { label: 'Closed', value: when(loan.closedAt) ?? '—' },
        ],
        guarantors: loan.guarantors.map((g) => ({
          id: g.id,
          name: g.user?.fullName || g.fullName || 'Unnamed guarantor',
          registered: Boolean(g.userId),
          status: g.status,
          note: g.note,
          respondedAt: when(g.respondedAt),
          phone: g.user?.phone || g.phone,
          idNumber: g.idNumber,
          residence: g.residence,
          relationship: g.relationship,
          kraPin: g.kraPin,
        })),
        decisions: [],
        payments: loan.ledgerLinks.map((l) => paymentRow(l.transaction)),
        trail: trailFor(loan.id),
        moduleOn: loansOn,
        canDecide: loansOn && pending && isAdmin,
        decideBlocked: !loansOn ? 'Loans are switched off' : pending && !isAdmin ? 'Only an Admin can approve or reject loans' : null,
        canDisburse: loansOn && loan.status === 'APPROVED' && isTreasurer && !loan.ledgerLinks.some((l) => l.kind === 'DISBURSEMENT'),
        proofRequired: false,
      }
    }),
    ...welfare.map((request): RequestItem => {
      const waitingDays = Math.floor((now.getTime() - request.createdAt.getTime()) / DAY_MS)
      const open = request.status === 'PENDING' || request.status === 'APPROVED'
      const overdue = open && waitingDays > WELFARE_OVERDUE_DAYS
      const ownRequest = request.userId === actor.id && !actor.isSuperAdmin
      const payments = welfarePayments.filter((p) => p.welfareRequestId === request.id)
      return {
        id: request.id,
        kind: 'WELFARE',
        person: request.user.fullName,
        amount: Number(request.amount),
        status: request.status,
        submittedAt: day(request.createdAt)!,
        dueLabel: open ? `Waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'}` : null,
        overdue,
        overdueLabel: overdue ? `Overdue — open more than ${WELFARE_OVERDUE_DAYS} days` : null,
        summary: request.supportType || request.category?.name || request.description,
        details: [
          { label: 'Requested by', value: `${request.user.fullName}${request.user.membershipNumber ? ` (${request.user.membershipNumber})` : ''}` },
          { label: 'Contact', value: [request.user.email, request.user.phone].filter(Boolean).join(' · ') },
          { label: 'Beneficiary', value: request.beneficiaryName || request.user.fullName },
          { label: 'Amount requested', value: `KES ${Number(request.amount).toLocaleString()}` },
          { label: 'Support type', value: request.supportType || request.category?.name || '—' },
          { label: 'Confidentiality', value: request.confidentiality === 'CONFIDENTIAL' ? 'Confidential' : 'Standard' },
          { label: 'Description', value: request.description },
          { label: 'Submitted', value: when(request.createdAt)! },
          { label: 'Treasurer approval', value: request.treasurerApprovedBy ? `${request.treasurerApprovedBy.fullName} · ${when(request.treasurerApprovedAt)}` : 'Not yet' },
          { label: 'Executive approval', value: request.executiveApprovedBy ? `${request.executiveApprovedBy.fullName} · ${when(request.executiveApprovedAt)}` : 'Not yet' },
          { label: 'Review note', value: request.reviewNote || '—' },
        ],
        guarantors: [],
        decisions: request.decisions.map((d) => ({ id: d.id, at: when(d.createdAt)!, who: d.actor.fullName, role: d.role, decision: d.decision, note: d.note })),
        payments: payments.map((p) => paymentRow(p.transaction)),
        trail: trailFor(request.id),
        moduleOn: welfareOn,
        canDecide: welfareOn && request.status === 'PENDING' && reviewsWelfare && !ownRequest,
        decideBlocked: !welfareOn ? 'Welfare is switched off' : request.status === 'PENDING' && ownRequest ? 'You cannot review your own request' : null,
        canDisburse: welfareOn && request.status === 'APPROVED' && isTreasurer && payments.length === 0,
        proofRequired: true,
      }
    }),
  ]

  return (
    <section id="request-history" className="space-y-4">
      <p className="text-xs text-on-surface-variant">
        Every loan and welfare request with its full history. Approving or rejecting does not move money; only a
        disbursement does.
      </p>
      <FinancialRequestsBoard items={items} accounts={accounts} today={appTodayInputValue()} />
    </section>
  )
}
