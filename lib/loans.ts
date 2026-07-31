import { prisma } from '@/lib/prisma'

export function moneyNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value)
}

/** Pure outstanding calculator for unit tests and shared use. */
export function outstandingFromLinks(
  links: Array<{ loanId?: string; kind: 'DISBURSEMENT' | 'REPAYMENT'; amount: unknown }>,
): number {
  let disbursed = 0
  let repaid = 0
  for (const link of links) {
    const amount = moneyNumber(link.amount)
    if (link.kind === 'DISBURSEMENT') disbursed += amount
    else repaid += amount
  }
  return Math.max(0, disbursed - repaid)
}

export function balancesFromLinks(
  loanIds: string[],
  links: Array<{ loanId: string; kind: 'DISBURSEMENT' | 'REPAYMENT'; amount: unknown }>,
): Map<string, number> {
  const map = new Map<string, { disbursed: number; repaid: number }>()
  for (const id of loanIds) map.set(id, { disbursed: 0, repaid: 0 })
  for (const link of links) {
    const row = map.get(link.loanId)
    if (!row) continue
    const amount = moneyNumber(link.amount)
    if (link.kind === 'DISBURSEMENT') row.disbursed += amount
    else row.repaid += amount
  }
  const out = new Map<string, number>()
  for (const [id, row] of map) out.set(id, Math.max(0, row.disbursed - row.repaid))
  return out
}

export async function loanOutstandingKes(loanId: string): Promise<number> {
  const links = await prisma.loanLedgerLink.findMany({
    where: {
      loanId,
      transaction: { status: { in: ['CONFIRMED', 'RECONCILED'] } },
    },
    include: { transaction: { select: { amount: true } } },
  })
  return outstandingFromLinks(
    links.map((link) => ({ kind: link.kind, amount: link.transaction.amount })),
  )
}

export async function loanBalancesForIds(loanIds: string[]) {
  if (!loanIds.length) return new Map<string, number>()
  const links = await prisma.loanLedgerLink.findMany({
    where: {
      loanId: { in: loanIds },
      transaction: { status: { in: ['CONFIRMED', 'RECONCILED'] } },
    },
    include: { transaction: { select: { amount: true } } },
  })
  return balancesFromLinks(
    loanIds,
    links.map((link) => ({
      loanId: link.loanId,
      kind: link.kind,
      amount: link.transaction.amount,
    })),
  )
}
