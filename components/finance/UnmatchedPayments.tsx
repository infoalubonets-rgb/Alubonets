'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import PaymentCategoryFields from '@/components/finance/PaymentCategoryFields'
import { reconcilePaymentEvent } from '@/app/actions/finance'

type UnmatchedEvent = { id: string; provider: string; reference: string; amount: number; phone: string | null; payerName: string | null; receivedAt: string }
type Member = { id: string; fullName: string; membershipNumber: string | null; phone: string | null }
type Category = { id: string; name: string; billingKind?: string | null }

function MatchEventButton({
  event,
  members,
  categories,
  campaigns,
  projects,
}: {
  event: UnmatchedEvent
  members: Member[]
  categories: Category[]
  campaigns: { id: string; title: string; categoryId: string }[]
  projects: { id: string; title: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setError('')
    setPending(true)
    try {
      await reconcilePaymentEvent(new FormData(formEvent.currentTarget))
      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reconcile this payment.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5">
        Reconcile
      </button>
      <FullScreenModal open={open} title="Match M-Pesa payment" onClose={() => setOpen(false)} size="compact">
        <form onSubmit={submit} className="space-y-3">
          <input type="hidden" name="eventId" value={event.id} />
          <p className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3 text-sm">
            <b>{event.provider} · {event.reference}</b>
            <br />
            KES {event.amount.toLocaleString()} · {event.payerName || event.phone || 'Unknown payer'} · {new Date(event.receivedAt).toLocaleString()}
          </p>
          <label className="block text-sm font-semibold">
            Member
            <select name="userId" required className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal">
              <option value="">Select member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.membershipNumber || '—'} · {m.fullName}{m.phone ? ` · ${m.phone}` : ''}</option>
              ))}
            </select>
          </label>
          <PaymentCategoryFields categories={categories} kind="income" showDescription={false} campaigns={campaigns} projects={projects} />
          <label className="block text-sm font-semibold">
            Notes
            <textarea name="notes" required minLength={5} maxLength={1000} rows={2} placeholder="How you confirmed who paid" className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal" />
          </label>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
              {pending ? 'Saving…' : 'Match and reconcile'}
            </button>
          </div>
        </form>
      </FullScreenModal>
    </>
  )
}

export default function UnmatchedPayments(props: {
  events: UnmatchedEvent[]
  members: Member[]
  categories: Category[]
  campaigns: { id: string; title: string; categoryId: string }[]
  projects: { id: string; title: string }[]
}) {
  if (!props.events.length) return null
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
      <h2 className="font-semibold">Unmatched M-Pesa payments ({props.events.length})</h2>
      <p className="text-xs text-on-surface-variant">These arrived without a clear member. Reconcile each one to the member who paid.</p>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {props.events.map((event) => (
            <tr key={event.id} className="border-t border-amber-200/70 dark:border-amber-500/20">
              <td className="py-2">{event.reference}</td>
              <td>KES {event.amount.toLocaleString()}</td>
              <td className="hidden sm:table-cell">{event.payerName || event.phone || '—'}</td>
              <td className="hidden sm:table-cell">{new Date(event.receivedAt).toLocaleDateString()}</td>
              <td className="text-right">
                <MatchEventButton event={event} members={props.members} categories={props.categories} campaigns={props.campaigns} projects={props.projects} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
