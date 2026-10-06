'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setContributionRights, setMemberStanding, setMemberStatus } from '@/app/actions/members'

export type MemberAccount = {
  id: string
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
    run(() => setMemberStatus({ userId: member.id, status }), status === 'ACTIVE' ? 'Member restored' : 'Member status updated', 'Could not update status')

  return (
    <div className="mt-4 space-y-4">
      <section className="space-y-2 border-t border-outline-variant pt-3">
        <div className="grid grid-cols-3 gap-2">
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
        {member.status === 'SUSPENDED' || member.status === 'INACTIVE' ? (
          <button type="button" disabled={pending} onClick={() => setStatus('ACTIVE')} className="h-11 w-full rounded-full border-2 border-primary text-sm font-label-bold text-primary hover:bg-primary/5 disabled:opacity-50">
            Restore member
          </button>
        ) : member.status === 'ACTIVE' ? (
          <div className="space-y-2">
            <button type="button" disabled={pending || member.isSuperAdmin} onClick={() => setStatus('SUSPENDED')} className="h-11 w-full rounded-full border border-error/40 text-sm font-label-bold text-error hover:bg-error-container/40 disabled:opacity-40">
              Suspend member
            </button>
            <div className="grid grid-cols-3 gap-2">
              {(['RESIGNED', 'DECEASED', 'DISQUALIFIED'] as const).map((status) => (
                <button key={status} type="button" disabled={pending || member.isSuperAdmin} onClick={() => setStatus(status)} className="h-9 rounded-lg border border-outline-variant text-[11px] font-semibold text-on-surface-variant hover:border-primary/40 disabled:opacity-40">
                  {status === 'RESIGNED' ? 'Resigned' : status === 'DECEASED' ? 'Deceased' : 'Disqualified'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Status actions apply to ACTIVE / SUSPENDED / INACTIVE members.</p>
        )}
        <p className="mt-2 text-[11px] text-on-surface-variant">Role and dashboard access are managed on the Roles page.</p>
      </section>

      {error && <p className="rounded-xl bg-error-container/40 px-3 py-2 text-center text-sm text-error">{error}</p>}
      {ok && !error && <p className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-center text-sm text-primary">{ok}</p>}
    </div>
  )
}
