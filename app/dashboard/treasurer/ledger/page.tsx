import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { recordLedgerContribution, proposeReversal } from '@/app/actions/finance'
import { accountBalances } from '@/lib/finance'
import PaymentCategoryFields from '@/components/finance/PaymentCategoryFields'
import RecordExpenseForm from '@/components/finance/RecordExpenseForm'
import { filterSelectableCategories } from '@/lib/payment-categories'

export default async function LedgerPage() {
  const [members, categories, campaigns, accounts, transactions, balances] = await Promise.all([
    prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' }, select: { id:true,fullName:true,membershipNumber:true } }),
    prisma.transactionCategory.findMany({ where: { active:true }, orderBy: { name:'asc' } }),
    prisma.contributionCampaign.findMany({ where: { active:true }, orderBy: { startsAt:'desc' } }),
    prisma.financialAccount.findMany({ where: { active:true,type:'ASSET' }, orderBy:{name:'asc'} }),
    prisma.financialTransaction.findMany({ orderBy:{occurredAt:'desc'},take:100,include:{category:true,createdBy:true} }),
    accountBalances(),
  ])
  const incomeCategories = filterSelectableCategories(categories, 'income')
  const expenseCategories = filterSelectableCategories(categories, 'expense')

  return <DashboardShell role="TREASURER" title="Financial ledger" nav={TREASURER_NAV}><div className="space-y-6 p-4 md:p-6">
    <section className="grid gap-3 md:grid-cols-3">{balances.filter((a)=>a.type==='ASSET').map((a)=><div key={a.id} className="rounded-xl border bg-surface p-4"><p className="text-xs uppercase">{a.name}</p><b>KES {a.balance.toLocaleString()}</b></div>)}</section>
    <section className="rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Record member contribution</h2>
      <form action={recordLedgerContribution} className="mt-3 grid gap-2 md:grid-cols-3">
        <select name="userId" required className="rounded-lg border px-3 py-2">{members.map((m)=><option key={m.id} value={m.id}>{m.membershipNumber||'—'} · {m.fullName}</option>)}</select>
        <select name="campaignId" className="rounded-lg border px-3 py-2"><option value="">No campaign</option>{campaigns.map((c)=><option key={c.id} value={c.id}>{c.title} · KES {Number(c.targetAmount).toLocaleString()}</option>)}</select>
        <PaymentCategoryFields categories={incomeCategories} kind="income" />
        <input name="amount" type="number" min="1" required placeholder="Amount KES" className="rounded-lg border px-3 py-2"/>
        <select name="sourceAccountId" required className="rounded-lg border px-3 py-2">{accounts.map((a)=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select name="paymentMethod" className="rounded-lg border px-3 py-2"><option>CASH</option><option>MPESA</option><option>BANK</option><option>OTHER</option></select>
        <input name="providerReference" placeholder="Unique transaction reference" className="rounded-lg border px-3 py-2"/>
        <input name="occurredAt" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="rounded-lg border px-3 py-2"/>
        <button className="w-fit rounded-full bg-primary px-4 py-2 text-on-primary md:col-span-3">Record contribution</button>
      </form>
    </section>
    <section className="rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Record expense</h2>
      <RecordExpenseForm categories={expenseCategories} accounts={accounts} />
    </section>
    <section className="rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-xl text-primary">Immutable transaction history</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Status</th><th>Category</th><th>Amount</th><th>Correction</th></tr></thead><tbody>{transactions.map((tx)=><tr key={tx.id} className="border-t"><td>{tx.transactionNumber}</td><td>{tx.occurredAt.toLocaleDateString()}</td><td>{tx.type}</td><td>{tx.status}</td><td>{tx.category?.name||'—'}</td><td>KES {Number(tx.amount).toLocaleString()}</td><td>{['CONFIRMED','RECONCILED'].includes(tx.status)&&<form action={proposeReversal} className="flex gap-1"><input type="hidden" name="id" value={tx.id}/><input name="reason" required minLength={5} placeholder="Correction reason" className="w-36 rounded border px-2"/><button className="text-error underline">Propose reversal</button></form>}</td></tr>)}</tbody></table></div></section>
  </div></DashboardShell>
}
