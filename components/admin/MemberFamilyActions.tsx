'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { setPrincipalStatus } from '@/app/actions/members'
import { assignMembersToPrincipal, listAssignableMembers, removeFromPrincipal } from '@/app/actions/member-admin'

type Assignable = Awaited<ReturnType<typeof listAssignableMembers>>[number]

const RELATIONSHIPS = [
  ['OTHER', 'Other'],
  ['SPOUSE', 'Spouse'],
  ['SON', 'Son'],
  ['DAUGHTER', 'Daughter'],
  ['CHILD', 'Child'],
  ['DEPENDENT', 'Dependent'],
] as const

/** Admin family controls in a member's eye pop-up: make Principal, assign members, detach. */
export default function MemberFamilyActions({
  member,
}: {
  member: { id: string; fullName: string; isPrincipal: boolean; principalName: string | null; active: boolean; attachedCount: number }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [candidates, setCandidates] = useState<Assignable[] | null>(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number][0]>('OTHER')

  const run = (work: () => Promise<unknown>, success: string) => {
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await work()
        setOk(success)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again.')
      }
    })
  }

  function openAssign() {
    setAssignOpen(true)
    setPicked(new Set())
    setQuery('')
    setCandidates(null)
    listAssignableMembers(member.id).then(setCandidates).catch(() => setError('Could not load members.'))
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (candidates ?? []).filter((c) => c.currentPrincipal !== 'this' && (!q || c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)))
  }, [candidates, query])

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function assign() {
    setError('')
    startTransition(async () => {
      try {
        const result = await assignMembersToPrincipal({ principalId: member.id, memberIds: [...picked], relationship })
        setAssignOpen(false)
        setOk(`${result.assigned} member${result.assigned === 1 ? '' : 's'} assigned. Everyone involved was notified and emailed.`)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not assign members.')
      }
    })
  }

  return (
    <section className="mt-4 space-y-2 border-t border-outline-variant pt-3">
      <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary">Family branch</p>
      <div className="flex flex-wrap gap-2">
        {member.isPrincipal ? (
          <>
            <button type="button" disabled={pending} onClick={openAssign} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-[12px] font-semibold text-on-primary disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">group_add</span>
              Assign members
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (member.attachedCount > 0 && !window.confirm(`${member.attachedCount} attached member(s) will be left with no Principal. Continue?`)) return
                run(() => setPrincipalStatus({ userId: member.id, isPrincipal: false }), 'Principal status removed.')
              }}
              className="h-9 rounded-lg border border-outline-variant px-3 text-[12px] font-semibold disabled:opacity-40"
            >
              Remove Principal status
            </button>
          </>
        ) : member.principalName ? (
          <button type="button" disabled={pending} onClick={() => run(() => removeFromPrincipal({ memberId: member.id }), 'Removed from the family branch.')} className="h-9 rounded-lg border border-error/40 px-3 text-[12px] font-semibold text-error disabled:opacity-50">
            Remove from {member.principalName}’s branch
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !member.active}
            title={member.active ? undefined : 'Only active members can be Principals'}
            onClick={() => run(() => setPrincipalStatus({ userId: member.id, isPrincipal: true }), `${member.fullName} is now a Principal Member.`)}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-[12px] font-semibold text-on-primary disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">family_restroom</span>
            Make Principal Member
          </button>
        )}
      </div>
      {error && <p className="rounded-xl bg-error-container/40 px-3 py-2 text-sm text-error">{error}</p>}
      {ok && !error && <p className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-sm text-primary">{ok}</p>}

      <FullScreenModal open={assignOpen} title={`Assign members to ${member.fullName}`} onClose={() => !pending && setAssignOpen(false)} size="compact">
        <div className="space-y-3">
          <label className="relative block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">search</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email…" className="h-10 w-full rounded-xl border bg-surface py-2 pl-9 pr-3 text-sm" autoFocus />
          </label>
          <div className="max-h-[45vh] divide-y divide-outline-variant/50 overflow-y-auto rounded-xl border border-outline-variant">
            {candidates === null ? (
              <p className="p-4 text-sm text-on-surface-variant">Loading members…</p>
            ) : visible.length === 0 ? (
              <p className="p-4 text-sm text-on-surface-variant">No members match.</p>
            ) : (
              visible.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-primary/[0.03]">
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-on-surface">{c.fullName}</span>
                    <span className="block truncate text-xs text-on-surface-variant">{c.email || 'No email (record only)'}</span>
                  </span>
                  {c.currentPrincipal && (
                    <span className="shrink-0 rounded-full bg-secondary-container/15 px-2 py-0.5 text-[10px] font-bold text-secondary" title="Assigning moves them to this branch">
                      In {c.currentPrincipal}’s branch
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
          <label className="block text-sm font-semibold text-on-surface">
            Relationship to {member.fullName}
            <select value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal">
              {RELATIONSHIPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <p className="text-xs text-on-surface-variant">Each member and {member.fullName} get a notification and an email.</p>
          <div className="flex justify-end gap-3">
            <button type="button" disabled={pending} onClick={() => setAssignOpen(false)} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="button" disabled={pending || picked.size === 0} onClick={assign} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
              {pending ? 'Assigning…' : `Assign ${picked.size || ''} member${picked.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </FullScreenModal>
    </section>
  )
}
