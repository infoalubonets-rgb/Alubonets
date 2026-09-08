'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import {
  approveFinancialTransaction,
  approveReversal,
  closeAccountingPeriod,
  createContributionCampaign,
  createContributionCategory,
  reopenAccountingPeriod,
  updateApprovalThreshold,
  updateLoanApplicationLimit,
} from '@/app/actions/finance'
import { filterAdminManagedCategories, filterSelectableCategories } from '@/lib/payment-categories'

type Category = { id: string; name: string; type: string; code: string; active: boolean }
type PendingTx = {
  id: string
  transactionNumber: string
  type: string
  amount: number
  description: string
  correctionReason: string | null
  createdByName: string
}
type Period = { id: string; month: number; monthLabel: string; status: string }

type ModalId = 'threshold' | 'categories' | 'campaigns' | 'transactions' | 'periods' | null

type Props = {
  approvalThreshold: string
  loanApplicationLimit: string
  categories: Category[]
  pending: PendingTx[]
  periods: Period[]
  currentMonth: number
  currentYear: number
  today: string
}

const tools = [
  {
    id: 'threshold' as const,
    icon: 'tune',
    label: 'Financial limits',
    tone: 'primary',
  },
  {
    id: 'categories' as const,
    icon: 'category',
    label: 'Payment categories',
    tone: 'primary',
  },
  {
    id: 'campaigns' as const,
    icon: 'campaign',
    label: 'Campaigns',
    tone: 'secondary',
  },
  {
    id: 'transactions' as const,
    icon: 'pending_actions',
    label: 'Pending transactions',
    tone: 'secondary',
  },
  {
    id: 'periods' as const,
    icon: 'calendar_month',
    label: 'Accounting periods',
    tone: 'primary',
  },
]

function toolButtonClass(tone: string) {
  return tone === 'secondary'
    ? 'border-secondary-container/40 bg-secondary-container text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] hover:opacity-90'
    : 'border-primary/30 bg-primary text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] hover:bg-primary-container'
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] text-on-surface-variant">{children}</p>
}

export default function AdminFinanceClient({ approvalThreshold, loanApplicationLimit, categories, pending, periods, currentMonth, currentYear, today }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalId>(null)
  const adminCategories = filterAdminManagedCategories(categories)
  const campaignCategories = filterSelectableCategories(categories, 'income')

  function closeModal() {
    setModal(null)
  }

  async function afterAction(action: (formData: FormData) => Promise<void>, formData: FormData) {
    await action(formData)
    router.refresh()
    closeModal()
  }

  async function afterActionKeepOpen(action: (formData: FormData) => Promise<void>, formData: FormData) {
    await action(formData)
    router.refresh()
  }

  const titles: Record<Exclude<ModalId, null>, string> = {
    threshold: 'Financial limits',
    categories: 'Payment categories',
    campaigns: 'Contribution campaigns',
    transactions: 'Pending transactions',
    periods: 'Accounting periods',
  }

  return (
    <>
      <section className="rounded-2xl border bg-surface p-4 md:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Admin tools</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => setModal(tool.id)}
                className={`flex min-h-14 items-center rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${toolButtonClass(tool.tone)}`}
              >
                <span className="inline-flex w-full items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <span className="material-symbols-outlined text-[18px]">{tool.icon}</span>
                    {tool.label}
                  </span>
                  {tool.id === 'transactions' && pending.length > 0 && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">{pending.length}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <FullScreenModal open={modal === 'threshold'} title={titles.threshold} onClose={closeModal}>
        <div className="grid gap-5 md:grid-cols-2">
          <form action={(formData) => afterActionKeepOpen(updateApprovalThreshold, formData)} className="rounded-xl border bg-surface-container-low p-4">
            <label className="text-sm font-semibold text-on-surface">
              Large transaction approval threshold (KES)
              <input name="amount" type="number" min="1" defaultValue={approvalThreshold} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
              <FieldHint>Expenses or disbursements at this amount require Admin approval. Contributions are not limited.</FieldHint>
            </label>
            <button className="mt-3 rounded-full bg-primary px-4 py-2 text-on-primary">Save approval threshold</button>
          </form>
          <form action={(formData) => afterActionKeepOpen(updateLoanApplicationLimit, formData)} className="rounded-xl border bg-surface-container-low p-4">
            <label className="text-sm font-semibold text-on-surface">
              Maximum loan application amount (KES)
              <input name="amount" type="number" min="100" max="999999" defaultValue={loanApplicationLimit} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
              <FieldHint>Members cannot request a loan above this amount.</FieldHint>
            </label>
            <button className="mt-3 rounded-full bg-primary px-4 py-2 text-on-primary">Save loan limit</button>
          </form>
        </div>
      </FullScreenModal>

      <FullScreenModal open={modal === 'categories'} title={titles.categories} onClose={closeModal}>
        <div className="space-y-5">
          <p className="text-sm text-on-surface-variant">
            Add categories treasurers can choose when recording a payment. If none fit, they can pick <b>Other</b> and write a short explanation.
          </p>
          <ContributionCategoriesManager
            categories={categories.filter((category) => category.active).map((category) => ({
              id: category.id,
              name: category.name,
              type: category.type,
              system: !adminCategories.some((managed) => managed.id === category.id),
            }))}
          />
        </div>
      </FullScreenModal>
      <FullScreenModal open={modal === 'campaigns'} title={titles.campaigns} onClose={closeModal}>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          A campaign creates a <b>target amount</b> for every active member (e.g. “Contribution 3 — KES 5,000 by 30 June”).
          Members see their obligation on the contributions page; the Treasurer records payments against it.
        </p>
        <form action={(formData) => afterAction(createContributionCampaign, formData)} className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">
            Campaign title
            <input name="title" required placeholder="e.g. Contribution 3" className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Target per member (KES)
            <input name="targetAmount" type="number" min="1" required placeholder="5000" className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Payment category
            <select name="categoryId" required className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal">
              {campaignCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldHint>Payments for this campaign are grouped under this label in reports.</FieldHint>
          </label>
          <label className="text-sm font-semibold">
            Start date
            <input name="startsAt" type="date" required min={today} defaultValue={today} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Due date (optional)
            <input name="dueAt" type="date" min={today} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Notes for members
            <textarea name="description" placeholder="What this campaign is for…" rows={3} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <button className="w-fit rounded-full bg-primary px-4 py-2 text-on-primary md:col-span-2">Create campaign</button>
        </form>
      </FullScreenModal>

      <FullScreenModal open={modal === 'transactions'} title={titles.transactions} onClose={closeModal}>
        <p className="mb-4 text-sm text-on-surface-variant">
          These ledger entries were submitted by the Treasurer (or exceed the approval threshold) and need your sign-off before they are final.
        </p>
        <div className="space-y-3">
          {pending.length === 0 ? (
            <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Nothing waiting — all caught up.</p>
          ) : (
            pending.map((tx) => (
              <article key={tx.id} className="rounded-xl bg-surface-container-low p-4">
                <p className="font-semibold text-on-surface">{tx.transactionNumber}</p>
                <p className="text-sm text-on-surface-variant">{tx.type.replaceAll('_', ' ')} · KES {tx.amount.toLocaleString()}</p>
                <p className="mt-1 text-sm">{tx.description}</p>
                <p className="text-xs text-on-surface-variant">Submitted by {tx.createdByName}</p>
                {tx.correctionReason && <p className="mt-1 text-sm text-on-surface-variant">Reason: {tx.correctionReason}</p>}
                <form action={(formData) => afterActionKeepOpen(tx.type === 'REVERSAL' ? approveReversal : approveFinancialTransaction, formData)} className="mt-3">
                  <input type="hidden" name="id" value={tx.id} />
                  <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Approve transaction</button>
                </form>
              </article>
            ))
          )}
        </div>
      </FullScreenModal>

      <FullScreenModal open={modal === 'periods'} title={titles.periods} onClose={closeModal}>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          Each calendar month is an accounting period. While <b>open</b>, the Treasurer can record payments in that month.
          After reconciliation, <b>close</b> the month to lock it. Reopen only if you need to fix something.
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">{currentYear} · current month highlighted</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {periods.map((period) => {
            const isCurrent = period.month === currentMonth
            const isOpen = period.status === 'OPEN'
            return (
              <div
                key={period.id}
                className={`rounded-lg p-3 ${isCurrent ? 'border-2 border-secondary-container bg-secondary-container/10' : 'bg-surface-container-low'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <b>{period.monthLabel}</b>
                  {isCurrent && <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-primary">Current</span>}
                </div>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${isOpen ? 'bg-green-100 text-green-800' : 'bg-surface-container text-on-surface-variant'}`}>
                    {isOpen ? 'Open — accepting entries' : 'Closed — locked'}
                  </span>
                </p>
                <form action={(formData) => afterActionKeepOpen(isOpen ? closeAccountingPeriod : reopenAccountingPeriod, formData)}>
                  <input type="hidden" name="id" value={period.id} />
                  <button type="submit" className="mt-2 text-sm font-semibold text-primary underline">
                    {isOpen ? 'Close period' : 'Reopen period'}
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </FullScreenModal>
    </>
  )
}
