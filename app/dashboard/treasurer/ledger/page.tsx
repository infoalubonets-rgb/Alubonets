import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { proposeReversal } from '@/app/actions/finance'
import { accountBalances } from '@/lib/finance'
import RecordExpenseForm from '@/components/finance/RecordExpenseForm'
import RecordContributionForm from '@/components/finance/RecordContributionForm'
import { filterSelectableCategories, isSystemCategoryCode } from '@/lib/payment-categories'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import { appTodayInputValue } from '@/lib/dates'

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams
  // ?month=YYYY-MM shows only that month's transactions.
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
  const periodFilter = monthMatch ? { period: { year: Number(monthMatch[1]), month: Number(monthMatch[2]) } } : {}
  const [members, categories, campaigns, accounts, transactions, balances, projects] = await Promise.all([
    prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' }, select: { id:true,fullName:true,membershipNumber:true } }),
    prisma.transactionCategory.findMany({ where: { active:true }, orderBy: { name:'asc' } }),
    prisma.contributionCampaign.findMany({ where: { active:true }, orderBy: { startsAt:'desc' } }),
    prisma.financialAccount.findMany({ where: { active:true,type:'ASSET' }, orderBy:{name:'asc'} }),
    prisma.financialTransaction.findMany({ where: periodFilter, orderBy:{occurredAt:'desc'},take:100,include:{category:true,createdBy:true} }),
    accountBalances(),
    prisma.project.findMany({ where: { status: { not: 'COMPLETED' } }, orderBy: { title: 'asc' }, select: { id: true, title: true } }),
  ])
  const today = appTodayInputValue()
  const incomeCategories = filterSelectableCategories(categories, 'income')
  const expenseCategories = filterSelectableCategories(categories, 'expense')

  return <DashboardShell role="TREASURER" title="Financial ledger" nav={TREASURER_NAV}><div className="space-y-6 p-4 md:p-6">
    <section className="grid gap-3 md:grid-cols-3">{balances.filter((a)=>a.type==='ASSET').map((a)=><div key={a.id} className="rounded-xl border bg-surface p-4"><p className="text-xs uppercase">{a.name}</p><b>KES {a.balance.toLocaleString()}</b></div>)}</section>
    <section className="rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Record member contribution</h2>
      <p className="mt-1 text-xs text-on-surface-variant">Every payment needs a purpose. Choose a campaign or project to count the payment towards its target. Historical payments can be backdated.</p>
      <RecordContributionForm
        members={members}
        campaigns={campaigns.map((c) => ({ id: c.id, title: c.title, categoryId: c.categoryId }))}
        categories={incomeCategories}
        accounts={accounts}
        projects={projects}
        today={today}
      />
    </section>
    <section className="rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Record expense</h2>
      <RecordExpenseForm categories={expenseCategories} accounts={accounts} projects={projects} today={today} />
    </section>
    <section className="rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Payment purposes</h2>
      <p className="mt-1 text-xs text-on-surface-variant">Add purposes the Treasurer can pick. Mark the monthly fee and annual subscription purposes so membership standing is calculated correctly.</p>
      <div className="mt-3">
        <ContributionCategoriesManager
          categories={categories
            .filter((category) => !isSystemCategoryCode(category.code))
            .map((category) => ({ id: category.id, name: category.name, type: category.type, billingKind: category.billingKind, system: false }))}
        />
      </div>
    </section>
    <section className="rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-xl text-primary">Immutable transaction history</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Status</th><th>Category</th><th>Amount</th><th>Correction</th></tr></thead><tbody>{transactions.map((tx)=><tr key={tx.id} className="border-t"><td>{tx.transactionNumber}</td><td>{tx.occurredAt.toLocaleDateString()}</td><td>{tx.type}</td><td>{tx.status}{tx.addedAfterClose&&<span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Added after close</span>}{tx.editedAfterClose&&<span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">Edited after close</span>}</td><td>{tx.category?.name||'—'}</td><td>KES {Number(tx.amount).toLocaleString()}</td><td>{['CONFIRMED','RECONCILED'].includes(tx.status)&&<form action={proposeReversal} className="flex gap-1"><input type="hidden" name="id" value={tx.id}/><input name="reason" required minLength={5} placeholder="Correction reason" className="w-36 rounded border px-2"/><button className="text-error underline">Propose reversal</button></form>}</td></tr>)}</tbody></table></div></section>
  </div></DashboardShell>
}
