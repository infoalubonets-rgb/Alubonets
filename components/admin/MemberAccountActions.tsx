'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMember, setContributionRights, setMemberStanding, setMemberStatus } from '@/app/actions/members'

export type MemberAccount = {
  id: string
  fullName?: string
  status: string
  isSuperAdmin: boolean
  isMinor: boolean
  standing: string
  standingReason: string | null
  standingOverride: string | null
  standingOverrideUntil: string | null
  contributionExempt: boolean
}

type Status = 'ACTIVE' | 'SUSPENDED' | 'DECEASED' | 'RESIGNED' | 'DISQUALIFIED' | 'INACTIVE'

const STATUSES: Status[] = ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'RESIGNED', 'DECEASED', 'DISQUALIFIED']
const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
  RESIGNED: 'Resigned',
  DECEASED: 'Deceased',
  DISQUALIFIED: 'Disqualified',
}

/** Admin-only controls for one member: standing, contribution rights and account status. */
export default function MemberAccountActions({ member }: { member: MemberAccount }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const run = (action: () => Promise<unknown>, success: string, failure: string) => {
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await action()
        setOk(success)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : failure)
      }
    })
  }

  const applyStanding = (mode: 'AUTO' | 'PAID_UP' | 'LAPSED') =>
    run(
      // A manual standing has no end date; "Automatic standing" hands it back to the payment rules.
      () => setMemberStanding({ userId: member.id, mode }),
      mode === 'AUTO' ? 'Standing returned to automatic rules' : mode === 'PAID_UP' ? 'Marked paid-up' : 'Marked lapsed',
      'Could not update standing',
    )

  const setStatus = (status: Status) =>
    run(() => setMemberStatus({ userId: member.id, status }), status === 'ACTIVE' ? 'Member restored' : `Status changed to ${STATUS_LABEL[status]}`, 'Could not update status')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const removeMember = () => {
    setError('')
    setOk('')
    startTransition(async () => {
      const result = await deleteMember({ userId: member.id })
      if (!result.ok) {
        setError(result.error)
        setConfirmDelete(false)
        return
      }
      setOk('Member deleted')
      router.refresh()
    })
  }

  return (
    <div className="mt-4 space-y-4">
      <section className="space-y-2 border-t border-outline-variant pt-3">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <button type="button" disabled={pending} onClick={() => applyStanding('PAID_UP')} className="h-9 rounded-lg bg-primary text-[11px] font-semibold text-on-primary disabled:opacity-50">Mark paid-up</button>
          <button type="button" disabled={pending} onClick={() => applyStanding('LAPSED')} className="h-9 rounded-lg border border-error/40 text-[11px] font-semibold text-error disabled:opacity-50">Mark lapsed</button>
          <button type="button" disabled={pending || !member.standingOverride} onClick={() => applyStanding('AUTO')} className="h-9 rounded-lg border border-outline-variant text-[11px] font-semibold disabled:opacity-40">Automatic standing</button>
        </div>
        <label className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Contribution rights</span>
            <span className="block text-[11px] text-on-surface-variant">
              {member.isMinor
                ? 'Under 18 — follows their Principal’s standing.'
                : member.contributionExempt
                  ? 'Removed — follows their Principal’s standing.'
                  : 'Pays their own dues — not affected by their Principal.'}
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={!member.contributionExempt}
            disabled={pending}
            onChange={(e) =>
              run(
                () => setContributionRights({ userId: member.id, canContribute: e.target.checked }),
                e.target.checked ? 'Contribution rights restored' : 'Contribution rights removed',
                'Could not update contribution rights',
              )
            }
          />
        </label>
      </section>

      <section className="border-t border-outline-variant pt-3">
        <p className="mb-2 font-label-bold text-[12px] uppercase tracking-wide text-secondary">Account actions</p>
        {/* Every status is always offered, so an admin can move a member to any other status later. */}
        <p className="mb-2 text-xs text-on-surface-variant">
          Current status: <span className="font-semibold text-on-surface">{STATUS_LABEL[member.status as Status] ?? member.status}</span>
        </p>
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
          {STATUSES.map((status) => {
            const current = member.status === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={current}
                disabled={pending || current || (member.isSuperAdmin && status !== 'ACTIVE')}
                onClick={() => setStatus(status)}
                className={`h-9 rounded-lg border text-[11px] font-semibold transition disabled:cursor-not-allowed ${
                  current
                    ? 'border-primary bg-primary text-on-primary'
                    : status === 'ACTIVE'
                      ? 'border-primary/50 text-primary hover:bg-primary/5 disabled:opacity-40'
                      : status === 'SUSPENDED'
                        ? 'border-error/40 text-error hover:bg-error-container/40 disabled:opacity-40'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary/40 disabled:opacity-40'
                }`}
              >
                {status === 'ACTIVE' && member.status !== 'ACTIVE' ? 'Restore (Active)' : STATUS_LABEL[status]}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-on-surface-variant">Role and dashboard access are managed on the Roles page.</p>
      </section>

      {!member.isSuperAdmin && (
        <section className="border-t border-outline-variant pt-3">
          <p className="mb-2 font-label-bold text-[12px] uppercase tracking-wide text-error">Delete member</p>
          {!confirmDelete ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => { setError(''); setOk(''); setConfirmDelete(true) }}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-error text-sm font-label-bold text-error hover:bg-error-container/40 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              Delete member permanently
            </button>
          ) : (
            <div role="alertdialog" aria-label="Confirm member deletion" className="space-y-2 rounded-xl border border-error/50 bg-error-container/30 p-3">
              <p className="text-sm font-semibold text-error">Are you sure?</p>
              <p className="text-xs text-on-surface-variant">
                This permanently deletes {member.fullName ? <strong>{member.fullName}</strong> : 'this member'} and all their details: profile, payments, family links,
                messages and sign-in. <strong>This cannot be undone.</strong>
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" disabled={pending} onClick={() => setConfirmDelete(false)} className="h-8 rounded-full border border-outline-variant px-3 text-xs font-semibold">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeMember}
                  className="h-8 rounded-full bg-error px-3 text-xs font-semibold text-on-error disabled:opacity-60"
                >
                  {pending ? 'Deleting…' : 'Yes, delete permanently'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {error && <p className="rounded-xl bg-error-container/40 px-3 py-2 text-center text-sm text-error">{error}</p>}
      {ok && !error && <p className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-center text-sm text-primary">{ok}</p>}
    </div>
  )
}
