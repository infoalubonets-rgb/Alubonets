'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import CampaignForm from '@/components/finance/CampaignForm'
import {
  approveFinancialTransaction,
  approveReversal,
  closeAccountingPeriod,
  createContributionCategory,
  reopenAccountingPeriod,
  updateApprovalThreshold,
  updateLoanApplicationLimit,
  updateStandingSettings,
} from '@/app/actions/finance'
import { filterAdminManagedCategories, filterSelectableCategories } from '@/lib/payment-categories'

type Category = { id: string; name: string; type: string; code: string; active: boolean; billingKind: string }
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

type ModalId = 'threshold' | 'standing' | 'categories' | 'campaigns' | 'transactions' | 'periods' | null

export type StandingSettingsView = {
  autoEnabled: boolean
  monthlyFeeKes: number
  monthlyGraceDays: number
  annualFeeKes: number
  annualRenewalDays: number
  effectiveFrom: string
}

type Props = {
  approvalThreshold: string
  loanApplicationLimit: string
  standingSettings: StandingSettingsView
  standingCounts: { paidUp: number; lapsed: number }
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
    id: 'standing' as const,
    icon: 'how_to_reg',
    label: 'Membership standing',
    tone: 'secondary',
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

function SavableForm({
  action,
  submitLabel,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<unknown>
  submitLabel: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const formData = new FormData(event.currentTarget)
    setError('')
    setSaved(false)
    setPending(true)
    try {
      const result = await Promise.race([
        action(formData),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Save is taking too long. Check your connection and try again.')), 20000)
        }),
      ])
      void result
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
      // Refresh in the background — never block the Saved state on it.
      void router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-on-primary disabled:cursor-wait disabled:opacity-60"
        >
          {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
          {pending ? 'Saving…' : submitLabel}
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>Saved
          </span>
        )}
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>
    </form>
  )
}

export default function AdminFinanceClient({ approvalThreshold, loanApplicationLimit, standingSettings, standingCounts, categories, pending, periods, currentMonth, currentYear, today }: Props) {
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
    standing: 'Membership standing',
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

      <FullScreenModal open={modal === 'threshold'} title={titles.threshold} onClose={closeModal} size="compact">
        <div className="grid gap-5 sm:grid-cols-2">
          <SavableForm
            action={updateApprovalThreshold}
            submitLabel="Save approval threshold"
            className="rounded-xl border bg-surface-container-low p-4"
          >
            <label className="text-sm font-semibold text-on-surface">
              Large transaction approval threshold (KES)
              <input name="amount" type="number" min="1" defaultValue={approvalThreshold} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
              <FieldHint>Expenses or disbursements above this amount require approval. Contributions are not limited.</FieldHint>
            </label>
          </SavableForm>
          <SavableForm
            action={updateLoanApplicationLimit}
            submitLabel="Save loan limit"
            className="rounded-xl border bg-surface-container-low p-4"
          >
            <label className="text-sm font-semibold text-on-surface">
              Maximum loan application amount (KES)
              <input name="amount" type="number" min="100" max="999999" defaultValue={loanApplicationLimit} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
              <FieldHint>Members cannot request a loan above this amount.</FieldHint>
            </label>
          </SavableForm>
        </div>
      </FullScreenModal>

      <FullScreenModal open={modal === 'standing'} title={titles.standing} onClose={closeModal} size="compact">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          Members who fall behind are marked <b>Lapsed</b>: they can still log in and see past events and the gallery, but not upcoming events or projects.
          As soon as a confirmed payment covers what they owe, they become <b>Paid-up</b> again automatically.
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">
          Currently {standingCounts.paidUp} paid-up · {standingCounts.lapsed} lapsed. Leave a fee at 0 to switch that rule off.
        </p>
        <SavableForm action={updateStandingSettings} submitLabel="Save standing rules" className="mt-4 grid gap-4 rounded-xl border bg-surface-container-low p-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-on-surface sm:col-span-2">
            <input name="autoEnabled" type="checkbox" defaultChecked={standingSettings.autoEnabled} className="h-4 w-4" />
            Update standing automatically from payments
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Monthly fee (KES)
            <input name="monthlyFeeKes" type="number" min="0" step="1" defaultValue={standingSettings.monthlyFeeKes} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
            <FieldHint>Paid under a purpose marked “Monthly”.</FieldHint>
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Monthly grace period (days)
            <input name="monthlyGraceDays" type="number" min="0" max="120" defaultValue={standingSettings.monthlyGraceDays} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
            <FieldHint>A month’s fee is due by month end; the member lapses this many days into the next month.</FieldHint>
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Annual subscription (KES)
            <input name="annualFeeKes" type="number" min="0" step="1" defaultValue={standingSettings.annualFeeKes} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
            <FieldHint>Paid under a purpose marked “Annual”. Covers 12 months.</FieldHint>
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Annual renewal window (days)
            <input name="annualRenewalDays" type="number" min="0" max="365" defaultValue={standingSettings.annualRenewalDays} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
            <FieldHint>Days after expiry before the member lapses.</FieldHint>
          </label>
          <label className="text-sm font-semibold text-on-surface sm:col-span-2">
            Count dues from
            <input name="effectiveFrom" type="date" required defaultValue={standingSettings.effectiveFrom} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
            <FieldHint>Months before this date are never charged. New members are charged from their approval date.</FieldHint>
          </label>
        </SavableForm>
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
              billingKind: category.billingKind,
              system: !adminCategories.some((managed) => managed.id === category.id),
            }))}
          />
        </div>
      </FullScreenModal>
      <FullScreenModal open={modal === 'campaigns'} title={titles.campaigns} onClose={closeModal}>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          A campaign has an <b>overall target</b> for the society and, optionally, a <b>target per member</b> (e.g. “Contribution 3 — KES 5,000 each”).
          Treasurers record payments against it by choosing the campaign as the payment purpose.{' '}
          <a href="/dashboard/treasurer/campaigns" className="font-semibold text-primary underline">See progress, edit or waive members</a>.
        </p>
        <div className="mt-5">
          <CampaignForm categories={campaignCategories} today={today} />
        </div>
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
