'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import MonthlyContributionsGrid from '@/components/dashboard/MonthlyContributionsGrid'
import TimeRangeFilter from '@/components/finance/TimeRangeFilter'
import { MemberPurposeSettingsButton } from '@/components/finance/PurposeSettingsEditor'
import { deleteContributions, deleteMembersContributions, editContributionAmount, setContributionPlan } from '@/app/actions/finance'

export type MemberContributionRow = {
  id: string
  fullName: string
  membershipNumber: string | null
  status: string
  standing: string
  /** MONTHLY or ANNUAL: which dues standing is checked against. Null until set. */
  plan: 'MONTHLY' | 'ANNUAL' | null
  payments: number
  totalPaid: number
  pending: number
  lastPaidAt: string | null
}

const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

type PaymentView = { id: string; amount: number; paidAt: string; purpose: string; status: string; method: string | null; reference: string | null }
type MemberDetail = {
  member: { id: string; fullName: string; membershipNumber: string | null; standing: string; standingReason: string | null; contributionPlan: 'MONTHLY' | 'ANNUAL' | null }
  contributions: PaymentView[]
  family: { id: string; fullName: string; contributions: PaymentView[] }[]
}

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-primary/10 text-primary',
  RECONCILED: 'bg-green-100 text-green-800',
  PENDING: 'bg-secondary-fixed text-secondary',
  REJECTED: 'bg-error-container text-error',
}

/** Loaded (and in-flight) member details, so hovering the eye starts the request and reopening is instant. */
const loadedDetails = new Map<string, MemberDetail>()
const pendingDetails = new Map<string, Promise<MemberDetail>>()

function loadDetail(id: string): Promise<MemberDetail> {
  const cached = loadedDetails.get(id)
  if (cached) return Promise.resolve(cached)
  const inFlight = pendingDetails.get(id)
  if (inFlight) return inFlight
  const request = fetch(`/api/contributions/member/${id}`, { cache: 'no-store' })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not load contributions.')
      loadedDetails.set(id, body as MemberDetail)
      return body as MemberDetail
    })
    .finally(() => pendingDetails.delete(id))
  pendingDetails.set(id, request)
  return request
}

const prefetchDetail = (id: string) => {
  loadDetail(id).catch(() => {})
}

const counts = (status: string) => status === 'CONFIRMED' || status === 'RECONCILED'
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

/** Treasurer-only inline correction of one payment's amount; the reason goes to the audit log. */
function EditAmountForm({ payment, onDone, onCancel }: { payment: PaymentView; onDone: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState(String(payment.amount))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const fd = new FormData()
    fd.set('id', payment.id)
    fd.set('amount', amount)
    fd.set('reason', reason)
    startTransition(async () => {
      const result = await editContributionAmount(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="w-full space-y-2 rounded-lg bg-surface-container-low p-2.5 dark:bg-[#0d1729]">
      <div className="flex flex-wrap gap-2">
        <label className="w-32 text-xs font-semibold text-on-surface-variant">
          New amount (KES)
          <input
            type="number"
            min="1"
            max="999999"
            step="0.01"
            required
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block h-9 w-full rounded-lg border px-2 text-sm font-normal text-on-surface"
          />
        </label>
        <label className="min-w-[12rem] flex-1 text-xs font-semibold text-on-surface-variant">
          Reason (saved in the audit log)
          <input
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Typed 1,250 instead of 1,500"
            className="mt-1 block h-9 w-full rounded-lg border px-2 text-sm font-normal text-on-surface"
          />
        </label>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className="h-8 rounded-full border border-outline-variant px-3 text-xs font-semibold">Cancel</button>
        <button type="submit" disabled={pending} className="h-8 rounded-full bg-primary px-3 text-xs font-semibold text-on-primary disabled:opacity-60">
          {pending ? 'Saving…' : 'Save amount'}
        </button>
      </div>
    </form>
  )
}

/** Reason prompt shown before payments are deleted; nothing is removed until it is confirmed. */
type DeleteResult = { ok: true } | { ok: false; error: string }

function DeleteConfirm({ ids, onDone, onCancel, title, confirmLabel, onConfirm }: {
  ids: string[]
  onDone: () => void
  onCancel: () => void
  title?: string
  confirmLabel?: string
  /** Defaults to deleting the given payment ids. */
  onConfirm?: (reason: string) => Promise<DeleteResult>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await (onConfirm ? onConfirm(reason) : deleteContributions({ ids, reason }))
      if (!result.ok) {
        setError(result.error)
        return
      }
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-error/40 bg-error-container/30 p-3">
      <p className="text-sm font-semibold text-error">{title ?? `Delete ${ids.length === 1 ? 'this payment' : `${ids.length} payments`}?`}</p>
      <p className="text-xs text-on-surface-variant">It is removed from the member&apos;s record and totals and reversed in the ledger. The reason is saved in the audit log.</p>
      <label className="block text-xs font-semibold text-on-surface-variant">
        Reason
        <input
          required
          minLength={3}
          maxLength={500}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Recorded twice by mistake"
          className="mt-1 block h-9 w-full rounded-lg border px-2 text-sm font-normal text-on-surface"
        />
      </label>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className="h-8 rounded-full border border-outline-variant px-3 text-xs font-semibold">Cancel</button>
        <button type="submit" disabled={pending} className="h-8 rounded-full bg-error px-3 text-xs font-semibold text-on-error disabled:opacity-60">
          {pending ? 'Deleting…' : confirmLabel ?? (ids.length === 1 ? 'Delete payment' : `Delete ${ids.length} payments`)}
        </button>
      </div>
    </form>
  )
}

type Selection = { selected: Set<string>; toggle: (ids: string[], on: boolean) => void; onDelete: (ids: string[]) => void }

function PaymentsList({ payments, canEdit = false, onChanged, selection }: { payments: PaymentView[]; canEdit?: boolean; onChanged?: () => void; selection?: Selection }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  if (payments.length === 0) {
    return <p className="rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant">No contributions recorded.</p>
  }
  const allIds = payments.map((p) => p.id)
  const allSelected = selection ? allIds.every((id) => selection.selected.has(id)) : false
  return (
    <ul className="divide-y divide-outline-variant/60 rounded-xl border border-outline-variant">
      {selection && (
        <li className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => selection.toggle(allIds, e.target.checked)}
            aria-label="Select all payments in this list"
            className="h-4 w-4 accent-primary"
          />
          Select all
        </li>
      )}
      {payments.map((p) => {
        const editable = canEdit && p.status !== 'REJECTED' && p.status !== 'REVERSED'
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              {selection && (
                <input
                  type="checkbox"
                  checked={selection.selected.has(p.id)}
                  onChange={(e) => selection.toggle([p.id], e.target.checked)}
                  aria-label={`Select ${p.purpose} payment of ${dateLabel(p.paidAt)}`}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-on-surface">{p.purpose}</p>
                <p className="text-xs text-on-surface-variant">
                  {dateLabel(p.paidAt)}
                  {p.method ? ` · ${p.method}` : ''}
                  {p.reference ? ` · ${p.reference}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[p.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
              </span>
              <span className={`font-semibold ${counts(p.status) ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>{kes.format(p.amount)}</span>
              {editable && editingId !== p.id && (
                <button
                  type="button"
                  onClick={() => setEditingId(p.id)}
                  title="Edit amount"
                  aria-label={`Edit amount of ${p.purpose} payment`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"
                >
                  <span className="material-symbols-outlined text-[17px]">edit</span>
                </button>
              )}
              {selection && (
                <button
                  type="button"
                  onClick={() => selection.onDelete([p.id])}
                  title="Delete payment"
                  aria-label={`Delete ${p.purpose} payment of ${dateLabel(p.paidAt)}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-error transition hover:bg-error/10"
                >
                  <span className="material-symbols-outlined text-[17px]">delete</span>
                </button>
              )}
            </div>
            {editingId === p.id && (
              <EditAmountForm
                payment={p}
                onCancel={() => setEditingId(null)}
                onDone={() => {
                  setEditingId(null)
                  onChanged?.()
                }}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

const PLAN_LABEL = { MONTHLY: 'Monthly', ANNUAL: 'Annual' } as const

/** Monthly / Annual switch: standing is checked only against the chosen plan's dues. */
function PlanSwitch({ memberId, plan, canEdit, onChanged }: { memberId: string; plan: 'MONTHLY' | 'ANNUAL' | null; canEdit: boolean; onChanged: () => void }) {
  const [current, setCurrent] = useState(plan)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  useEffect(() => setCurrent(plan), [plan])

  const choose = (next: 'MONTHLY' | 'ANNUAL') => {
    if (next === current || pending) return
    const previous = current
    setCurrent(next)
    setError('')
    startTransition(async () => {
      const result = await setContributionPlan({ userId: memberId, plan: next })
      if (!result.ok) {
        setCurrent(previous)
        setError(result.error)
        return
      }
      onChanged()
    })
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Contribution plan</p>
          <p className="text-xs text-on-surface-variant">
            {current === 'MONTHLY'
              ? 'Tracked against the monthly contribution.'
              : current === 'ANNUAL'
                ? 'Tracked against the annual contribution.'
                : 'Not set yet: checked against both monthly and annual dues.'}
          </p>
        </div>
        <div role="radiogroup" aria-label="Contribution plan" className="inline-flex rounded-full border border-outline-variant p-0.5">
          {(['MONTHLY', 'ANNUAL'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={current === option}
              disabled={!canEdit || pending}
              onClick={() => choose(option)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed ${
                current === option ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-primary/5'
              } ${!canEdit && current !== option ? 'opacity-50' : ''}`}
            >
              {PLAN_LABEL[option]}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

function MemberContributionsModal({ row, onClose, canEditAmounts = false, canSetPlan = false, canDelete = false }: { row: MemberContributionRow | null; onClose: () => void; canEditAmounts?: boolean; canSetPlan?: boolean; canDelete?: boolean }) {
  const router = useRouter()
  // After an edit, reload this member's payments and the table totals behind the pop-up.
  const [state, setState] = useState<{ id: string; data?: MemberDetail; error?: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const rowId = row?.id
  // Payments ticked for deletion (own and attached members), and the ones awaiting a reason.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<string[] | null>(null)
  useEffect(() => {
    setSelected(new Set())
    setConfirming(null)
  }, [rowId])
  const selection: Selection | undefined = canDelete
    ? {
        selected,
        toggle: (ids, on) =>
          setSelected((current) => {
            const next = new Set(current)
            for (const id of ids) {
              if (on) next.add(id)
              else next.delete(id)
            }
            return next
          }),
        onDelete: (ids) => setConfirming(ids),
      }
    : undefined
  const refresh = () => {
    if (rowId) loadedDetails.delete(rowId)
    setAttempt((n) => n + 1)
    router.refresh()
  }

  useEffect(() => {
    if (!rowId) return
    let cancelled = false
    const ready = loadedDetails.get(rowId)
    setState(ready ? { id: rowId, data: ready } : { id: rowId })
    loadDetail(rowId)
      .then((data) => {
        if (!cancelled) setState({ id: rowId, data })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ id: rowId, error: e instanceof Error ? e.message : 'Could not load contributions.' })
      })
    return () => { cancelled = true }
  }, [rowId, attempt])

  const data = row ? (state?.id === row.id ? state.data : undefined) ?? loadedDetails.get(row.id) : undefined
  const error = state?.id === row?.id ? state?.error : undefined
  const confirmed = data?.contributions.filter((p) => counts(p.status)) ?? []

  return (
    <FullScreenModal open={Boolean(row)} title={row ? `${row.fullName} — contributions` : 'Contributions'} onClose={onClose} size="compact">
      {row && (
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            {row.membershipNumber ? `${row.membershipNumber} · ` : ''}
            <span className={row.standing === 'PAID_UP' ? 'font-semibold text-green-700' : 'font-semibold text-error'}>
              {row.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'}
            </span>
          </p>

          {error ? (
            <div className="space-y-2 rounded-xl bg-error-container/40 px-3 py-3 text-sm text-error">
              <p>{error}</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline">Try again</button>
            </div>
          ) : !data ? (
            <div className="flex items-center gap-2 py-8 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              Loading contributions…
            </div>
          ) : (
            <>
              <PlanSwitch memberId={data.member.id} plan={data.member.contributionPlan} canEdit={canSetPlan} onChanged={refresh} />
              {data.member.standing !== 'PAID_UP' && data.member.standingReason && (
                <p className="rounded-lg bg-error-container/50 px-3 py-2 text-xs text-error">Why lapsed: {data.member.standingReason}</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total paid', value: kes.format(confirmed.reduce((sum, p) => sum + p.amount, 0)) },
                  { label: 'Payments', value: confirmed.length },
                  { label: 'Pending', value: data.contributions.filter((p) => p.status === 'PENDING').length },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{stat.label}</p>
                    <p className="text-base font-semibold text-on-surface">{stat.value}</p>
                  </div>
                ))}
              </div>

              {canDelete && selected.size > 0 && !confirming && (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 shadow-sm">
                  <p className="text-sm font-semibold text-on-surface">{selected.size} selected</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-full border border-outline-variant px-3 text-xs font-semibold">Clear</button>
                    <button type="button" onClick={() => setConfirming([...selected])} className="inline-flex h-8 items-center gap-1 rounded-full bg-error px-3 text-xs font-semibold text-on-error">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete selected
                    </button>
                  </div>
                </div>
              )}
              {confirming && (
                <DeleteConfirm
                  ids={confirming}
                  onCancel={() => setConfirming(null)}
                  onDone={() => {
                    setConfirming(null)
                    setSelected(new Set())
                    refresh()
                  }}
                />
              )}

              <PaymentsList payments={data.contributions} canEdit={canEditAmounts} onChanged={refresh} selection={selection} />

              {data.family.map((member) => (
                <div key={member.id} className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Attached: {member.fullName}</p>
                  <PaymentsList payments={member.contributions} canEdit={canEditAmounts} onChanged={refresh} selection={selection} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </FullScreenModal>
  )
}

/** Every member's contribution totals; the eye opens that member's payments in a pop-up. */
export default function MemberContributionsTable({ rows, period = { key: 'all', from: '', to: '', label: 'All time' }, canEditAmounts = false, canSetPlan = false, canDelete = false }: { rows: MemberContributionRow[]; period?: { key: string; from: string; to: string; label: string }; canEditAmounts?: boolean; canSetPlan?: boolean; canDelete?: boolean }) {
  // The time filter lives in the URL so totals come from the server for that period.
  const filtered = period.key !== 'all'
  const monthLabel = filtered ? period.label : null
  const [viewing, setViewing] = useState<MemberContributionRow | null>(null)
  const [query, setQuery] = useState('')
  // New rows mean payments changed, so pop-up details loaded earlier may be out of date.
  useEffect(() => {
    loadedDetails.clear()
  }, [rows])
  // With a time period chosen, only members who paid in it are listed (switch to "Not paid" to see the rest).
  const [show, setShow] = useState<'all' | 'paid' | 'none'>(filtered ? 'paid' : 'all')
  useEffect(() => {
    setShow(filtered ? 'paid' : 'all')
  }, [filtered, period.from, period.to, period.key])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (show === 'paid' && row.payments === 0) return false
      if (show === 'none' && row.payments > 0) return false
      return !q || row.fullName.toLowerCase().includes(q) || row.membershipNumber?.toLowerCase().includes(q)
    })
  }, [rows, query, show])

  const router = useRouter()
  // Members ticked for deleting all their payments, and the ones awaiting a reason.
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirmingMembers, setConfirmingMembers] = useState<MemberContributionRow[] | null>(null)
  const hasPayments = (row: MemberContributionRow) => row.payments > 0 || row.pending > 0
  const pickable = visible.filter(hasPayments)
  const allPicked = pickable.length > 0 && pickable.every((row) => picked.has(row.id))
  const pick = (ids: string[], on: boolean) =>
    setPicked((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  useEffect(() => {
    // Drop picks for members that no longer have payments after a refresh.
    setPicked((current) => new Set([...current].filter((id) => rows.some((row) => row.id === id && hasPayments(row)))))
  }, [rows])

  const totals = {
    collected: rows.reduce((sum, row) => sum + row.totalPaid, 0),
    contributing: rows.filter((row) => row.payments > 0).length,
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-10 md:px-0">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: monthLabel ? `Collected · ${monthLabel}` : 'Total collected', value: kes.format(totals.collected) },
          { label: 'Contributing members', value: rows.length },
          { label: monthLabel ? 'Paid in this period' : 'Contributing', value: totals.contributing },
          { label: 'Pending checks', value: totals.pending },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{stat.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-on-surface">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search member or membership number…" className="h-10 w-full rounded-xl border bg-surface py-2 pl-9 pr-3 text-sm" />
        </label>
        {/* Only members who have paid are listed, so the paid / not-paid split matters only for a period. */}
        {filtered && (
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Filter members by payments" className="h-10 rounded-xl border bg-surface px-3 text-sm">
            <option value="all">All contributing members</option>
            <option value="paid">Paid in this period</option>
            <option value="none">Not paid in this period</option>
          </select>
        )}
        <TimeRangeFilter key={`${period.key}|${period.from}|${period.to}`} range={period.key} from={period.from} to={period.to} />
        <MonthlyContributionsGrid />
      </div>

      {canDelete && picked.size > 0 && !confirmingMembers && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-sm font-semibold text-on-surface">{picked.size} member{picked.size === 1 ? '' : 's'} selected</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPicked(new Set())} className="h-9 rounded-full border border-outline-variant px-4 text-xs font-semibold">Clear</button>
            <button
              type="button"
              onClick={() => setConfirmingMembers(rows.filter((row) => picked.has(row.id)))}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-error px-4 text-xs font-semibold text-on-error"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Delete their contributions
            </button>
          </div>
        </div>
      )}
      {confirmingMembers && (
        <DeleteConfirm
          ids={[]}
          title={
            confirmingMembers.length === 1
              ? `Delete all contributions of ${confirmingMembers[0].fullName}?`
              : `Delete all contributions of ${confirmingMembers.length} members?`
          }
          confirmLabel={confirmingMembers.length === 1 ? 'Delete their contributions' : `Delete contributions of ${confirmingMembers.length} members`}
          onConfirm={(reason) => deleteMembersContributions({ memberIds: confirmingMembers.map((row) => row.id), reason })}
          onCancel={() => setConfirmingMembers(null)}
          onDone={() => {
            setConfirmingMembers(null)
            setPicked(new Set())
            loadedDetails.clear()
            router.refresh()
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-left">
                {canDelete && (
                  <th className="w-10 py-3 pl-4">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      disabled={pickable.length === 0}
                      onChange={(e) => pick(pickable.map((row) => row.id), e.target.checked)}
                      aria-label="Select all members with payments"
                      className="h-4 w-4 accent-primary"
                    />
                  </th>
                )}
                {['Member', 'Payments', 'Total paid', 'Last payment', 'Standing'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">{heading}</th>
                ))}
                <th className="w-16 px-4 py-3 text-right font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">{canDelete ? 'Actions' : 'View'}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={canDelete ? 7 : 6} className="py-10 text-center text-on-surface-variant">{filtered && show === 'paid' && !query.trim() ? `Nobody paid in this period (${period.label.toLowerCase()}).` : rows.length === 0 ? 'No member has made a payment yet. Members appear here after their first payment.' : 'No members match.'}</td></tr>
              ) : (
                visible.map((row, i) => (
                  <tr key={row.id} className={`border-t border-outline-variant/50 transition-colors hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                    {canDelete && (
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          checked={picked.has(row.id)}
                          disabled={!hasPayments(row)}
                          onChange={(e) => pick([row.id], e.target.checked)}
                          aria-label={`Select ${row.fullName}`}
                          className="h-4 w-4 accent-primary disabled:opacity-30"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setViewing(row)} onPointerEnter={() => prefetchDetail(row.id)} onFocus={() => prefetchDetail(row.id)} className="text-left font-medium text-on-surface hover:text-primary hover:underline">{row.fullName}</button>
                      <p className="text-xs text-on-surface-variant">
                        {row.membershipNumber || '—'}
                        <span className={`ml-1.5 rounded-full px-1.5 text-[10px] font-bold ${row.plan ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                          {row.plan ? PLAN_LABEL[row.plan] : 'No plan'}
                        </span>
                        {row.status !== 'ACTIVE' && <span className="ml-1.5 rounded-full bg-surface-container px-1.5 text-[10px] font-bold">{row.status.toLowerCase()}</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {row.payments}
                      {row.pending > 0 && <span className="ml-1.5 rounded-full bg-secondary-fixed px-1.5 text-[10px] font-bold text-secondary">{row.pending} pending</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-on-surface">{kes.format(row.totalPaid)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.lastPaidAt ? new Date(row.lastPaidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.standing === 'PAID_UP' ? 'bg-green-100 text-green-800' : 'bg-error-container text-error'}`}>
                        {row.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{canSetPlan && <MemberPurposeSettingsButton memberId={row.id} name={row.fullName} />}
                      <button type="button" onClick={() => setViewing(row)} onPointerEnter={() => prefetchDetail(row.id)} onFocus={() => prefetchDetail(row.id)} title="View contributions" aria-label={`View contributions for ${row.fullName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10">
                        <span className="material-symbols-outlined text-[19px]">visibility</span>
                      </button>
                      {canDelete && hasPayments(row) && (
                        <button type="button" onClick={() => setConfirmingMembers([row])} title="Delete this member's contributions" aria-label={`Delete contributions of ${row.fullName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-error transition hover:bg-error/10">
                          <span className="material-symbols-outlined text-[19px]">delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">Totals count confirmed and reconciled payments. Pending payments are still waiting for a second check.</p>
      <MemberContributionsModal row={viewing} onClose={() => setViewing(null)} canEditAmounts={canEditAmounts} canSetPlan={canSetPlan} canDelete={canDelete} />
    </div>
  )
}

