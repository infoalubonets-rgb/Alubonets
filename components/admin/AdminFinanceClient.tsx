'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import CampaignForm from '@/components/finance/CampaignForm'
import {
  approveFinancialTransaction,
  approveReversal,
  createContributionCategory,
  updateApprovalThreshold,
  updateLoanApplicationLimit,
  updateStandingSettings,
  toggleAccountingPeriod,
} from '@/app/actions/finance'
import { campaignPurposeCategories, filterAdminManagedCategories } from '@/lib/payment-categories'
import { upcomingAnnualRenewalDay, upcomingMonthlyDeadlines } from '@/lib/membership-standing'
import { ACCOUNTING_PERIOD_CHANGED } from '@/components/dashboard/OldMonthPill'

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
type Period = {
  key: string
  year: number
  month: number
  monthLabel: string
  status: string
  closesOn: string
  hasData: boolean
  /** False for future months and for past months with nothing recorded. */
  canOpen: boolean
}

type ModalId = 'threshold' | 'standing' | 'categories' | 'campaigns' | 'transactions' | 'periods' | null

export type StandingSettingsView = {
  monthlyFeeKes: number
  monthlyGraceDays: number
  annualFeeKes: number
  annualRenewalDays: number
  annualDueDate: string | null
  effectiveFrom: string
}

type Props = {
  approvalThreshold: string
  loanApplicationLimit: string
  standingSettings: StandingSettingsView
  categories: Category[]
  pending: PendingTx[]
  periods: Period[]
  currentMonth: number
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

function parseDateInput(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function shortDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function NextDeadline({ date }: { date: Date }) {
  return <p className="mt-1 text-[12px] font-semibold text-red-600">Next deadline: {shortDate(date)}</p>
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function StandingSettingsForm({ settings, today }: { settings: StandingSettingsView; today: string }) {
  const todayDate = parseDateInput(today) ?? new Date()
  const savedFrom = parseDateInput(settings.effectiveFrom) ?? todayDate
  const [monthlyFee, setMonthlyFee] = useState(String(settings.monthlyFeeKes))
  const [annualFee, setAnnualFee] = useState(String(settings.annualFeeKes))
  const [monthlyPick, setMonthlyPick] = useState(() =>
    dateInputValue(upcomingMonthlyDeadlines(todayDate, settings.monthlyGraceDays, savedFrom, 1)[0].lastDay),
  )
  const [annualPick, setAnnualPick] = useState(() =>
    dateInputValue(upcomingAnnualRenewalDay(todayDate, settings, savedFrom)),
  )

  const fromDate = savedFrom
  const monthlyDate = parseDateInput(monthlyPick)
  const annualDate = parseDateInput(annualPick)
  // Only the day of the monthly pick and the day + month of the annual pick are stored.
  const graceDays = monthlyDate ? monthlyDate.getUTCDate() : settings.monthlyGraceDays
  const annualDueDate = annualDate ? annualPick.slice(5) : settings.annualDueDate

  const nextMonthly = fromDate ? upcomingMonthlyDeadlines(todayDate, graceDays, fromDate, 1)[0]?.lastDay : null
  const nextAnnual = fromDate
    ? upcomingAnnualRenewalDay(todayDate, { annualRenewalDays: settings.annualRenewalDays, annualDueDate }, fromDate)
    : null

  return (
    <SavableForm action={updateStandingSettings} submitLabel="Save" className="grid gap-4 rounded-xl border bg-surface-container-low p-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-on-surface">
        Monthly contribution (KES)
        <input name="monthlyFeeKes" type="number" min="0" step="1" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-semibold text-on-surface">
        Monthly contribution deadline
        <input
          type="date"
          required
          value={monthlyPick}
          onChange={(e) => setMonthlyPick(e.target.value)}
          className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal"
        />
        {/* Every month has a 28th; 29–31 would skip February. */}
        {monthlyDate && monthlyDate.getUTCDate() > 28 && <FieldHint>Pick a day from 1 to 28 so it falls in every month.</FieldHint>}
        <input type="hidden" name="monthlyGraceDays" value={graceDays} />
        {nextMonthly && <NextDeadline date={nextMonthly} />}
      </label>
      <label className="text-sm font-semibold text-on-surface">
        Annual contribution (KES)
        <input name="annualFeeKes" type="number" min="0" step="1" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-semibold text-on-surface">
        Annual contribution deadline
        <input type="date" required value={annualPick} onChange={(e) => setAnnualPick(e.target.value)} className="mt-2 block w-full rounded-lg border px-3 py-2 font-normal" />
        <input type="hidden" name="annualDueDate" value={annualDueDate ?? ''} />
        {nextAnnual && <NextDeadline date={nextAnnual} />}
      </label>
    </SavableForm>
  )
}

function PeriodCard({ period, isCurrent, onToggle }: { period: Period; isCurrent: boolean; onToggle: (period: Period) => void }) {
  const isOpen = period.status === 'OPEN'
  // Future months and empty past months: nothing to open or view.
  const noData = !isOpen && !period.canOpen
  return (
    <article
      className={`rounded-lg p-3 transition ${isCurrent ? 'border-2 border-secondary-container bg-secondary-container/10' : 'border border-transparent bg-surface-container-low'} ${noData ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <b>{period.monthLabel}</b>
        {isCurrent && <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-primary">Current</span>}
      </div>
      <p className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
        {noData ? (
          <span className="inline-flex rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">No data</span>
        ) : (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${isOpen ? 'bg-green-100 text-green-800' : 'bg-surface-container text-on-surface-variant'}`}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        )}
        {isOpen && <span>Closes {period.closesOn}</span>}
      </p>
      {!noData && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggle(period)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${isOpen ? 'bg-red-600 hover:bg-red-700' : 'bg-green-700 hover:bg-green-800'}`}
          >
            {isOpen ? 'Close month' : 'Open month'}
          </button>
          <Link href={`/admin/finance?month=${period.key}`} className="text-xs font-semibold text-primary underline">View month</Link>
        </div>
      )}
    </article>
  )
}

export default function AdminFinanceClient({ approvalThreshold, loanApplicationLimit, standingSettings, categories, pending, periods, currentMonth, today }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalId>(null)
  const [confirmPeriod, setConfirmPeriod] = useState<Period | null>(null)
  const [periodPending, setPeriodPending] = useState(false)
  const [periodError, setPeriodError] = useState('')
  const adminCategories = filterAdminManagedCategories(categories)
  const campaignCategories = campaignPurposeCategories(categories)

  function closeModal() {
    setModal(null)
  }

  async function confirmPeriodToggle() {
    if (!confirmPeriod || periodPending) return
    setPeriodPending(true)
    setPeriodError('')
    try {
      const formData = new FormData()
      formData.set('month', confirmPeriod.key)
      await toggleAccountingPeriod(formData)
      setConfirmPeriod(null)
      window.dispatchEvent(new Event(ACCOUNTING_PERIOD_CHANGED))
      router.refresh()
    } catch (error) {
      setPeriodError(error instanceof Error ? error.message : 'Could not update the month. Try again.')
    } finally {
      setPeriodPending(false)
    }
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
        <StandingSettingsForm settings={standingSettings} today={today} />
      </FullScreenModal>

      <FullScreenModal open={modal === 'categories'} title={titles.categories} onClose={closeModal} size="compact">
        <div className="space-y-5">
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
      <FullScreenModal open={modal === 'campaigns'} title={titles.campaigns} onClose={closeModal} size="compact">
        <CampaignForm categories={campaignCategories} today={today} />
        <Link
          href="/dashboard/treasurer/campaigns"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5"
        >
          <span className="material-symbols-outlined text-[18px]">list</span>
          View all campaigns
        </Link>
      </FullScreenModal>

      <FullScreenModal open={modal === 'transactions'} title={titles.transactions} onClose={closeModal} size="compact">
        <p className="mb-4 text-sm text-on-surface-variant">Payments waiting for your approval.</p>
        <div className="space-y-3">
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
              Nothing to approve.
            </p>
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
                  <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Approve</button>
                </form>
              </article>
            ))
          )}
        </div>
      </FullScreenModal>

      <FullScreenModal open={modal === 'periods'} title={titles.periods} onClose={closeModal}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {periods.map((period) => (
            <PeriodCard key={period.key} period={period} isCurrent={period.month === currentMonth} onToggle={setConfirmPeriod} />
          ))}
        </div>
      </FullScreenModal>

      <FullScreenModal
        open={Boolean(confirmPeriod)}
        title={`${confirmPeriod?.status === 'OPEN' ? 'Close' : 'Open'} ${confirmPeriod?.monthLabel ?? 'month'}?`}
        onClose={() => !periodPending && setConfirmPeriod(null)}
        size="compact"
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            {confirmPeriod?.status === 'OPEN'
              ? `Are you sure you want to close ${confirmPeriod.monthLabel} ${confirmPeriod.year}? New or edited entries will be marked as changes made after closing.`
              : `Are you sure you want to open ${confirmPeriod?.monthLabel} ${confirmPeriod?.year}? Any other open month will be closed automatically.`}
          </p>
          {periodError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{periodError}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={periodPending} onClick={() => setConfirmPeriod(null)} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="button" disabled={periodPending} onClick={confirmPeriodToggle} className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${confirmPeriod?.status === 'OPEN' ? 'bg-red-600' : 'bg-green-700'}`}>
              {periodPending ? 'Updating…' : confirmPeriod?.status === 'OPEN' ? 'Yes, close month' : 'Yes, open month'}
            </button>
          </div>
        </div>
      </FullScreenModal>
    </>
  )
}
