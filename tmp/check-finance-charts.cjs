require('@next/env').loadEnvConfig(process.cwd())
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const [transactions, contributions] = await db.$transaction([
    db.financialTransaction.findMany({ select: { type: true, status: true, amount: true } }),
    db.contribution.findMany({ where: { status: { in: ['CONFIRMED', 'RECONCILED'] } }, select: { amount: true, paymentMethod: true, userId: true, paidAt: true } }),
  ])
  const posted = transactions.filter(t => ['CONFIRMED', 'RECONCILED'].includes(t.status))
  const sum = rows => rows.reduce((n, r) => n + Number(r.amount), 0)
  console.log(JSON.stringify({ ledgerIncome: sum(posted.filter(t => t.type === 'CONTRIBUTION')), ledgerOutgoing: sum(posted.filter(t => ['EXPENSE', 'DISBURSEMENT'].includes(t.type))), contributions: contributions.length, contributionTotal: sum(contributions), contributingMembers: new Set(contributions.map(c => c.userId)).size, mpesa: contributions.filter(c => c.paymentMethod === 'MPESA').length, byMonth: Object.fromEntries([...new Set(contributions.map(c => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(c.paidAt).slice(0, 7)))].sort().map(m => [m, sum(contributions.filter(c => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(c.paidAt).startsWith(m)))])) }, null, 2))
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => db.$disconnect())
