export function summariseFinance(rows: Array<{ type: string; status: string; amount: number | { toString(): string }; categoryId: string | null }>) {
  const confirmed = rows.filter((r) => ['CONFIRMED', 'RECONCILED'].includes(r.status))
  const total = (predicate: (r: typeof rows[number]) => boolean) => confirmed.filter(predicate).reduce((n, r) => n + Number(r.amount), 0)
  const income = total((r) => r.type === 'CONTRIBUTION')
  const outgoing = total((r) => ['EXPENSE', 'DISBURSEMENT'].includes(r.type))
  return { income, outgoing, net: income - outgoing,
    loanDisbursed: total((r) => r.categoryId === 'cat-loan-disbursement'),
    loanRepaid: total((r) => r.categoryId === 'cat-loan-repayment'),
    welfarePaid: total((r) => r.categoryId === 'cat-welfare-disbursement'),
  }
}
