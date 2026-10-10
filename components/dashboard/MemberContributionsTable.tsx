'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { editContributionAmount } from '@/app/actions/finance'

export type MemberContributionRow = {
  id: string
  fullName: string
  membershipNumber: string | null
  status: string
  standing: string
  payments: number
  totalPaid: number
  pending: number
  lastPaidAt: string | null
}

const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

type PaymentView = { id: string; amount: number; paidAt: string; purpose: string; status: string; method: string | null; reference: string | null }
type MemberDetail = {
  member: { id: string; fullName: string; membershipNumber: string | null; standing: string }
  contributions: PaymentView[]
  family: { id: string; fullName: string; contributions: PaymentView[] }[]
}

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-primary/10 text-primary',
  RECONCILED: 'bg-green-100 text-green-800',
  PENDING: 'bg-secondary-fixed text-secondary',
  REJECTED: 'bg-error-container text-error',
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

function PaymentsList({ payments, canEdit = false, onChanged }: { payments: PaymentView[]; canEdit?: boolean; onChanged?: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  if (payments.length === 0) {
    return <p className="rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant">No contributions recorded.</p>
  }
  return (
    <ul className="divide-y divide-outline-variant/60 rounded-xl border border-outline-variant">
      {payments.map((p) => {
        const editable = canEdit && p.status !== 'REJECTED' && p.status !== 'REVERSED'
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-on-surface">{p.purpose}</p>
              <p className="text-xs text-on-surface-variant">
                {dateLabel(p.paidAt)}
                {p.method ? ` · ${p.method}` : ''}
                {p.reference ? ` · ${p.reference}` : ''}
              </p>
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

function MemberContributionsModal({ row, onClose, canEditAmounts = false }: { row: MemberContributionRow | null; onClose: () => void; canEditAmounts?: boolean }) {
  const router = useRouter()
  // After an edit, reload this member's payments and the table totals behind the pop-up.
  const refresh = () => {
    setAttempt((n) => n + 1)
    router.refresh()
  }
  const [state, setState] = useState<{ id: string; data?: MemberDetail; error?: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const rowId = row?.id

  useEffect(() => {
    if (!rowId) return
    let cancelled = false
    setState({ id: rowId })
    fetch(`/api/contributions/member/${rowId}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Could not load contributions.')
        if (!cancelled) setState({ id: rowId, data: body as MemberDetail })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ id: rowId, error: e instanceof Error ? e.message : 'Could not load contributions.' })
      })
    return () => { cancelled = true }
  }, [rowId, attempt])

  const data = state?.id === row?.id ? state?.data : undefined
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

              <PaymentsList payments={data.contributions} canEdit={canEditAmounts} onChanged={refresh} />

              {data.family.map((member) => (
                <div key={member.id} className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Attached: {member.fullName}</p>
                  <PaymentsList payments={member.contributions} canEdit={canEditAmounts} onChanged={refresh} />
                </div>
              ))}
            </>
          )}

          <Link href={`/contributions/member/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Open full page
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          </Link>
        </div>
      )}
    </FullScreenModal>
  )
}

/** Every member's contribution totals; the eye opens that member's payments in a pop-up. */
export default function MemberContributionsTable({ rows, canEditAmounts = false }: { rows: MemberContributionRow[]; canEditAmounts?: boolean }) {
  const [viewing, setViewing] = useState<MemberContributionRow | null>(null)
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<'all' | 'paid' | 'none'>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (show === 'paid' && row.payments === 0) return false
      if (show === 'none' && row.payments > 0) return false
      return !q || row.fullName.toLowerCase().includes(q) || row.membershipNumber?.toLowerCase().includes(q)
    })
  }, [rows, query, show])

  const totals = {
    collected: rows.reduce((sum, row) => sum + row.totalPaid, 0),
    contributing: rows.filter((row) => row.payments > 0).length,
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-10 md:px-0">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total collected', value: kes.format(totals.collected) },
          { label: 'Members', value: rows.length },
          { label: 'Contributing', value: totals.contributing },
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
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Filter members by payments" className="h-10 rounded-xl border bg-surface px-3 text-sm">
          <option value="all">All members</option>
          <option value="paid">Have paid</option>
          <option value="none">Not yet paid</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-left">
                {['Member', 'Payments', 'Total paid', 'Last payment', 'Standing'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">{heading}</th>
                ))}
                <th className="w-16 px-4 py-3 text-right font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">View</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-on-surface-variant">No members match.</td></tr>
              ) : (
                visible.map((row, i) => (
                  <tr key={row.id} className={`border-t border-outline-variant/50 transition-colors hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/contributions/member/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">{row.fullName}</Link>
                      <p className="text-xs text-on-surface-variant">
                        {row.membershipNumber || '—'}
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
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setViewing(row)} title="View contributions" aria-label={`View contributions for ${row.fullName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10">
                        <span className="material-symbols-outlined text-[19px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">Totals count confirmed and reconciled payments. Pending payments are still waiting for a second check.</p>
      <MemberContributionsModal row={viewing} onClose={() => setViewing(null)} canEditAmounts={canEditAmounts} />
    </div>
  )
}
