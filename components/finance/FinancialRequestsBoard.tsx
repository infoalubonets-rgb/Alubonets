'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { decideLoanApplication, recordLoanDisbursement } from '@/app/actions/loans'
import { actionReviewWelfare } from '@/app/actions/welfare'
import { recordWelfareDisbursement, requestEvidenceUploadUrl } from '@/app/actions/finance'
import { uploadToSignedUrlWithProgress } from '@/lib/upload-client'
import { readableError } from '@/lib/form-errors'

export type RequestItem = {
  id: string
  kind: 'LOAN' | 'WELFARE'
  person: string
  amount: number
  status: string
  submittedAt: string
  dueLabel: string | null
  overdue: boolean
  overdueLabel: string | null
  summary: string
  details: { label: string; value: string }[]
  guarantors: {
    id: string
    name: string
    registered: boolean
    status: string
    note: string | null
    respondedAt: string | null
    phone: string | null
    idNumber: string | null
    residence: string | null
    relationship: string | null
    kraPin: string | null
  }[]
  decisions: { id: string; at: string; who: string; role: string; decision: string; note: string | null }[]
  payments: { id: string; label: string; status: string; amount: number; at: string; by: string }[]
  trail: { id: string; at: string; who: string; action: string; reason: string | null }[]
  moduleOn: boolean
  canDecide: boolean
  /** Why approve/reject is unavailable, shown on the disabled buttons. */
  decideBlocked: string | null
  canDisburse: boolean
  /** Welfare payouts need a supporting document; loan payouts may attach one. */
  proofRequired: boolean
}

type Account = { id: string; name: string }
type Filter = 'ALL' | 'LOAN' | 'WELFARE'
type Dialog = { item: RequestItem; mode: 'APPROVED' | 'REJECTED' | 'DISBURSE' } | null

const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-secondary-fixed text-secondary',
  UNDER_REVIEW: 'bg-secondary-fixed text-secondary',
  PENDING: 'bg-secondary-fixed text-secondary',
  APPROVED: 'bg-primary/10 text-primary',
  DISBURSED: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  CLOSED: 'bg-surface-container-high text-on-surface-variant',
  REJECTED: 'bg-error-container text-error',
}

export default function FinancialRequestsBoard({ items, accounts, today }: { items: RequestItem[]; accounts: Account[]; today: string }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [viewing, setViewing] = useState<RequestItem | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)

  const counts = useMemo(
    () => ({ ALL: items.length, LOAN: items.filter((i) => i.kind === 'LOAN').length, WELFARE: items.filter((i) => i.kind === 'WELFARE').length }),
    [items],
  )
  const shown = items
    .filter((item) => filter === 'ALL' || item.kind === filter)
    .filter((item) => !onlyOpen || item.canDecide || item.canDisburse || item.overdue)
    // Overdue first, then the newest.
    .sort((a, b) => Number(b.overdue) - Number(a.overdue))
  const overdueCount = items.filter((i) => i.overdue && (filter === 'ALL' || i.kind === filter)).length

  const done = () => {
    setDialog(null)
    setViewing(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Request type" className="inline-flex rounded-full border border-outline-variant p-0.5">
          {(['ALL', 'LOAN', 'WELFARE'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filter === key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-primary/5'}`}
            >
              {key === 'ALL' ? 'Both' : key === 'LOAN' ? 'Loans' : 'Welfare'} <span className="opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="h-4 w-4 accent-primary" />
          Needs action only
        </label>
        {overdueCount > 0 && (
          <span className="ml-auto rounded-full bg-error-container px-2.5 py-1 text-[11px] font-bold text-error">{overdueCount} overdue</span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant py-8 text-center text-sm text-on-surface-variant">No requests match.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className={`flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3 ${item.overdue ? 'border-error/50 shadow-[inset_4px_0_0_#dc2626]' : 'border-outline-variant'}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.kind === 'LOAN' ? 'bg-primary/10 text-primary' : 'bg-secondary-container/15 text-secondary'}`}>
                <span className="material-symbols-outlined text-[20px]">{item.kind === 'LOAN' ? 'request_quote' : 'volunteer_activism'}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {item.person} <span className="font-bold text-primary">· {kes(item.amount)}</span>
                </p>
                <p className="truncate text-xs text-on-surface-variant">
                  {item.kind === 'LOAN' ? 'Loan' : 'Welfare'} · {item.summary}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[item.status] ?? 'bg-surface-container text-on-surface-variant'}`}>{label(item.status)}</span>
                  <span className="text-on-surface-variant">Submitted {item.submittedAt}</span>
                  {item.dueLabel && <span className={item.overdue ? 'font-semibold text-error' : 'text-on-surface-variant'}>· {item.dueLabel}</span>}
                  {item.overdueLabel && <span className="rounded-full bg-error px-2 py-0.5 font-bold text-on-error">{item.overdueLabel}</span>}
                  {item.kind === 'LOAN' && item.guarantors.length > 0 && (
                    <span className="text-on-surface-variant">
                      · Guarantors {item.guarantors.filter((g) => g.status === 'ACCEPTED').length}/{item.guarantors.length} accepted
                    </span>
                  )}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto">
                <button type="button" onClick={() => setViewing(item)} title="View all details" aria-label={`View ${item.person}'s request`} className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-primary hover:bg-primary/5">
                  <span className="material-symbols-outlined text-[19px]">visibility</span>
                </button>
                <ActionButtons item={item} onAction={(mode) => setDialog({ item, mode })} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Second pop-up: everything about one request. */}
      <FullScreenModal open={Boolean(viewing)} title={viewing ? `${viewing.kind === 'LOAN' ? 'Loan' : 'Welfare'} request · ${viewing.person}` : 'Request'} onClose={() => setViewing(null)} size="wide">
        {viewing && <RequestDetail item={viewing} onAction={(mode) => setDialog({ item: viewing, mode })} />}
      </FullScreenModal>

      <FullScreenModal
        open={Boolean(dialog)}
        title={dialog ? (dialog.mode === 'DISBURSE' ? `Disburse ${kes(dialog.item.amount)} to ${dialog.item.person}` : `${dialog.mode === 'APPROVED' ? 'Approve' : 'Reject'} ${dialog.item.person}'s ${dialog.item.kind === 'LOAN' ? 'loan' : 'welfare'} request`) : ''}
        onClose={() => setDialog(null)}
        size="compact"
      >
        {dialog && (dialog.mode === 'DISBURSE'
          ? <DisburseForm item={dialog.item} accounts={accounts} today={today} onDone={done} onCancel={() => setDialog(null)} />
          : <DecisionForm item={dialog.item} decision={dialog.mode} onDone={done} onCancel={() => setDialog(null)} />)}
      </FullScreenModal>
    </div>
  )
}

function ActionButtons({ item, onAction }: { item: RequestItem; onAction: (mode: 'APPROVED' | 'REJECTED' | 'DISBURSE') => void }) {
  const pendingDecision = ['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(item.status)
  return (
    <>
      {pendingDecision && (
        <>
          <button type="button" disabled={!item.canDecide} title={item.decideBlocked ?? 'Approve'} onClick={() => onAction('APPROVED')} className="h-9 rounded-full bg-primary px-3.5 text-xs font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40">
            Approve
          </button>
          <button type="button" disabled={!item.canDecide} title={item.decideBlocked ?? 'Reject'} onClick={() => onAction('REJECTED')} className="h-9 rounded-full border border-error/50 px-3.5 text-xs font-semibold text-error disabled:cursor-not-allowed disabled:opacity-40">
            Reject
          </button>
        </>
      )}
      {item.status === 'APPROVED' && (
        <button type="button" disabled={!item.canDisburse} title={item.canDisburse ? 'Record the payout' : 'Only the Treasurer records payouts'} onClick={() => onAction('DISBURSE')} className="inline-flex h-9 items-center gap-1 rounded-full bg-secondary-container px-3.5 text-xs font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40">
          <span className="material-symbols-outlined text-[16px]">payments</span>
          Disburse
        </button>
      )}
    </>
  )
}

function RequestDetail({ item, onAction }: { item: RequestItem; onAction: (mode: 'APPROVED' | 'REJECTED' | 'DISBURSE') => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status] ?? 'bg-surface-container'}`}>{label(item.status)}</span>
        {item.overdueLabel && <span className="rounded-full bg-error px-2.5 py-1 text-xs font-bold text-on-error">{item.overdueLabel}</span>}
        {item.dueLabel && !item.overdue && <span className="text-xs text-on-surface-variant">{item.dueLabel}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5"><ActionButtons item={item} onAction={onAction} /></div>
      </div>
      {item.decideBlocked && ['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(item.status) && (
        <p className="rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface-variant">{item.decideBlocked}.</p>
      )}

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {item.details.map((row) => (
          <div key={row.label} className="min-w-0 border-b border-outline-variant/40 pb-1.5">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{row.label}</dt>
            <dd className="break-words text-sm text-on-surface">{row.value || '—'}</dd>
          </div>
        ))}
      </dl>

      {item.kind === 'LOAN' && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-primary">Guarantors ({item.guarantors.length})</h3>
          {item.guarantors.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No guarantors recorded.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {item.guarantors.map((g) => (
                <li key={g.id} className="rounded-xl border border-outline-variant p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{g.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${g.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' : g.status === 'DECLINED' ? 'bg-error-container text-error' : 'bg-secondary-fixed text-secondary'}`}>{label(g.status)}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{g.registered ? 'Registered member' : 'External guarantor'}{g.relationship ? ` · ${g.relationship}` : ''}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {[g.phone && `Phone ${g.phone}`, g.idNumber && `ID ${g.idNumber}`, g.kraPin && `KRA ${g.kraPin}`, g.residence && `Lives in ${g.residence}`].filter(Boolean).join(' · ') || 'No extra details'}
                  </p>
                  {(g.respondedAt || g.note) && <p className="mt-1 text-xs">{g.respondedAt ? `Responded ${g.respondedAt}` : ''}{g.note ? ` — “${g.note}”` : ''}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {item.decisions.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-primary">Decisions</h3>
          <ul className="space-y-1 text-sm">
            {item.decisions.map((d) => <li key={d.id}>{d.at} · {d.who} ({label(d.role)}) · <b>{label(d.decision)}</b>{d.note ? ` — ${d.note}` : ''}</li>)}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-bold text-primary">Payments</h3>
        {item.payments.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No money has moved for this request yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {item.payments.map((p) => <li key={p.id}>{p.at} · {p.label} · <b>{kes(p.amount)}</b> · {label(p.status)} · by {p.by}</li>)}
          </ul>
        )}
      </section>

      <details className="rounded-xl border border-outline-variant p-3">
        <summary className="cursor-pointer text-sm font-semibold">Activity trail ({item.trail.length})</summary>
        <ol className="mt-2 space-y-1.5 text-xs">
          {item.trail.map((t) => <li key={t.id} className="border-l-2 border-outline-variant pl-2">{t.at} · {t.who} · {label(t.action)}{t.reason ? ` — ${t.reason}` : ''}</li>)}
          {item.trail.length === 0 && <li className="text-on-surface-variant">No recorded activity.</li>}
        </ol>
      </details>
    </div>
  )
}

function DecisionForm({ item, decision, onDone, onCancel }: { item: RequestItem; decision: 'APPROVED' | 'REJECTED'; onDone: () => void; onCancel: () => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const fd = new FormData()
      if (item.kind === 'LOAN') {
        fd.set('loanId', item.id)
        fd.set('decision', decision)
        if (note.trim()) fd.set('decisionNote', note.trim())
        await decideLoanApplication(fd)
      } else {
        fd.set('id', item.id)
        fd.set('status', decision)
        if (note.trim()) fd.set('reviewNote', note.trim())
        await actionReviewWelfare(fd)
      }
      onDone()
    } catch (cause) {
      setError(readableError(cause, 'Could not save this decision.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-on-surface-variant">
        {kes(item.amount)} · {item.summary}
        {item.kind === 'WELFARE' && decision === 'APPROVED' && ' — welfare needs both Treasurer and Executive approval before it can be paid.'}
      </p>
      <label className="block text-sm font-semibold">
        {decision === 'REJECTED' ? 'Reason (sent to the member)' : 'Note (optional)'}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required={decision === 'REJECTED'} minLength={decision === 'REJECTED' ? 3 : undefined} maxLength={1000} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal" />
      </label>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-full border border-outline-variant px-4 text-sm font-semibold">Cancel</button>
        <button type="submit" disabled={pending} className={`h-10 rounded-full px-4 text-sm font-semibold text-white disabled:opacity-60 ${decision === 'APPROVED' ? 'bg-primary' : 'bg-error'}`}>
          {pending ? 'Saving…' : decision === 'APPROVED' ? 'Approve' : 'Reject'}
        </button>
      </div>
    </form>
  )
}

function DisburseForm({ item, accounts, today, onDone, onCancel }: { item: RequestItem; accounts: Account[]; today: string; onDone: () => void; onCancel: () => void }) {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(event.currentTarget)
    const proof = form.get('evidence') as File | null
    try {
      if (item.proofRequired && !proof?.size) throw new Error('Attach the supporting document for this payout.')
      const fd = new FormData()
      fd.set('amount', String(form.get('amount')))
      fd.set('sourceAccountId', String(form.get('sourceAccountId')))
      fd.set('occurredAt', String(form.get('occurredAt')))
      if (item.kind === 'LOAN') {
        fd.set('loanId', item.id)
        if (proof?.size) fd.set('evidence', proof)
        await recordLoanDisbursement(fd)
      } else {
        const request = new FormData()
        request.set('fileName', proof!.name)
        const { bucket, path, token } = await requestEvidenceUploadUrl(request)
        await uploadToSignedUrlWithProgress(bucket, path, token, proof!, (percent) => setStatus(`Uploading proof… ${percent}%`))
        fd.set('welfareRequestId', item.id)
        fd.set('evidencePath', path)
        fd.set('evidenceMimeType', proof!.type || 'application/octet-stream')
        fd.set('evidenceTitle', proof!.name)
        await recordWelfareDisbursement(fd)
      }
      onDone()
    } catch (cause) {
      setError(readableError(cause, 'Could not record this payout.'))
    } finally {
      setPending(false)
      setStatus('')
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Amount (KES)
        <input name="amount" type="number" min="1" step="0.01" required defaultValue={item.amount} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal" />
      </label>
      <label className="text-sm font-semibold">Paid from
        <select name="sourceAccountId" required className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Date paid
        <input name="occurredAt" type="date" required max={today} defaultValue={today} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal" />
      </label>
      <label className="text-sm font-semibold">Proof {item.proofRequired ? <span className="text-error">*</span> : <span className="font-normal text-on-surface-variant">(optional)</span>}
        <input name="evidence" type="file" required={item.proofRequired} accept=".pdf,.png,.webp,.jpeg,.jpg,application/pdf,image/png,image/webp,image/jpeg" className="mt-1 block w-full text-xs" />
      </label>
      <p className="text-xs text-on-surface-variant sm:col-span-2">Payouts above the approval limit wait for a second person to approve them in the ledger.</p>
      {status && <p className="text-xs text-on-surface-variant sm:col-span-2">{status}</p>}
      {error && <p className="text-sm text-error sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-full border border-outline-variant px-4 text-sm font-semibold">Cancel</button>
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-secondary-container px-4 text-sm font-semibold text-on-primary disabled:opacity-60">
          {pending ? 'Recording…' : 'Record payout'}
        </button>
      </div>
    </form>
  )
}
