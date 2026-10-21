import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { getPeriodForDate, markEditedAfterClose, periodFields, recomputeStandingSafely, refreshObligation, transactionNumber } from '@/lib/finance'

/**
 * Deletes recorded payments on behalf of an already-authorised actor (callers check permissions).
 * Ledger rows are locked once posted, so a posted payment gets a confirmed reversal entry and a
 * pending one is rejected; the payment itself is marked Reversed, which drops it from every list,
 * total and standing check. Each deletion is audited with the reason. Already-reversed payments
 * are skipped. Returns how many were deleted.
 */
export async function reverseContributions(actorId: string, ids: string[], reason: string): Promise<number> {
  const contributions = await prisma.contribution.findMany({
    where: { id: { in: [...new Set(ids)] }, status: { not: 'REVERSED' } },
    include: { user: { select: { fullName: true } } },
  })
  const note = `Deleted: ${reason}`

  for (const contribution of contributions) {
    const original = contribution.financialTransactionId
      ? await prisma.financialTransaction.findUnique({ where: { id: contribution.financialTransactionId }, include: { entries: true } })
      : null
    const posted = original && (original.status === 'CONFIRMED' || original.status === 'RECONCILED')
    const period = posted ? await getPeriodForDate(original.occurredAt) : null
    await prisma.$transaction(async (tx) => {
      if (original && posted && period) {
        await tx.financialTransaction.create({
          data: {
            transactionNumber: transactionNumber(),
            type: 'REVERSAL',
            status: 'CONFIRMED',
            amount: original.amount,
            description: `Reversal of ${original.transactionNumber} (payment deleted)`,
            occurredAt: original.occurredAt,
            correctionReason: note,
            ...periodFields(period),
            createdById: actorId,
            approvedById: actorId,
            confirmedAt: new Date(),
            originalTransactionId: original.id,
            entries: { create: original.entries.map((entry) => ({ accountId: entry.accountId, debit: entry.credit, credit: entry.debit, memo: note })) },
          },
        })
        await tx.financialTransaction.update({ where: { id: original.id }, data: { status: 'REVERSED', reversedAt: new Date(), correctionReason: note } })
        await markEditedAfterClose(original.id, tx)
      } else if (original?.status === 'PENDING') {
        await tx.financialTransaction.update({ where: { id: original.id }, data: { status: 'REJECTED', correctionReason: note } })
      }
      await tx.contribution.update({ where: { id: contribution.id }, data: { status: 'REVERSED', correctionReason: note } })
      if (contribution.campaignId) await refreshObligation(contribution.campaignId, contribution.userId, tx)
    })
    await writeAudit({
      userId: actorId,
      action: 'CONTRIBUTION_DELETE',
      entity: 'Contribution',
      entityId: contribution.id,
      reason,
      oldValue: { amount: Number(contribution.amount), status: contribution.status, paidAt: contribution.paidAt.toISOString() },
      newValue: { status: 'REVERSED' },
      meta: { memberName: contribution.user.fullName, category: contribution.category },
    })
  }

  for (const userId of new Set(contributions.map((c) => c.userId))) await recomputeStandingSafely(userId, actorId)
  const projectIds = [...new Set(contributions.map((c) => c.projectId).filter((id): id is string => Boolean(id)))]
  if (projectIds.length) {
    const { syncProjectFinancials } = await import('@/lib/project-status')
    for (const projectId of projectIds) await syncProjectFinancials(projectId).catch(() => {})
  }
  return contributions.length
}
