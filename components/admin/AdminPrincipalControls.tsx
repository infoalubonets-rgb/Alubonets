'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPrincipalStatus, transferFamilyMember } from '@/app/actions/members'

export default function AdminPrincipalControls({
  userId,
  fullName,
  isPrincipal,
  status,
  attachedCount,
  currentPrincipalId,
  principalOptions,
}: {
  userId: string
  fullName: string
  isPrincipal: boolean
  status: string
  attachedCount: number
  currentPrincipalId?: string | null
  principalOptions: { id: string; fullName: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [pending, startTransition] = useTransition()
  const [newPrincipalId, setNewPrincipalId] = useState(principalOptions[0]?.id || '')
  const [relationship, setRelationship] = useState('OTHER')
  const [reason, setReason] = useState('')

  const run = (next: boolean) => {
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await setPrincipalStatus({ userId, isPrincipal: next })
        setOk(next ? 'Marked as Principal Member' : 'Principal status removed')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update Principal status')
      }
    })
  }

  return (
    <section className="rounded-2xl border bg-surface p-5 space-y-3">
      <h2 className="font-h3 text-xl text-primary">Principal Member</h2>
      <p className="text-sm text-on-surface-variant">
        {isPrincipal
          ? `${fullName} is a Principal and can manage a family branch (${attachedCount} attached).`
          : `${fullName} is not a Principal. Only Admin can assign Principal status.`}
      </p>
      {isPrincipal ? (
        <button
          type="button"
          disabled={pending || attachedCount > 0}
          onClick={() => run(false)}
          className="rounded-full border border-error/40 px-4 py-2 text-sm text-error disabled:opacity-40"
        >
          Remove Principal status
        </button>
      ) : (
        <button
          type="button"
          disabled={pending || status !== 'ACTIVE'}
          onClick={() => run(true)}
          className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40"
        >
          Make Principal Member
        </button>
      )}
      {attachedCount > 0 && isPrincipal && (
        <p className="text-xs text-on-surface-variant">
          Transfer or detach all attached members before removing Principal status.
        </p>
      )}
      {currentPrincipalId && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-primary">Transfer family member</h3>
          <p className="text-xs text-on-surface-variant">
            Only an Administrator can move this member to another Principal branch. The transfer is permanently recorded.
          </p>
          <select value={newPrincipalId} onChange={(event) => setNewPrincipalId(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
            {principalOptions.map((principal) => <option key={principal.id} value={principal.id}>{principal.fullName}</option>)}
          </select>
          <select value={relationship} onChange={(event) => setRelationship(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="DEPENDENT">Dependent</option><option value="OTHER">Other</option>
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for transfer" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <button type="button" disabled={pending || !newPrincipalId || reason.trim().length < 5} onClick={() => {
            setError(''); setOk('')
            startTransition(async () => {
              try {
                await transferFamilyMember({ memberId: userId, newPrincipalId, relationship: relationship as 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER', reason })
                setOk('Family member transferred and history recorded')
                setReason('')
                router.refresh()
              } catch (e) { setError(e instanceof Error ? e.message : 'Could not transfer family member') }
            })
          }} className="rounded-full bg-secondary-container px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-40">Transfer branch</button>
        </div>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
      {ok && !error && <p className="text-sm text-primary">{ok}</p>}
    </section>
  )
}
