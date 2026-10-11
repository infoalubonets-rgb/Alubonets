'use client'
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { linkFamilyMembers, setPrincipalStatus } from '@/app/actions/members'
import ErrorDialog from '@/components/ui/ErrorDialog'
import { friendlyError } from '@/lib/safe-error'

type Member = { id: string; fullName: string; email: string; phone: string | null; status: string; isPrincipal: boolean; principalMemberId: string | null; principalName: string | null; relationship: string | null }
type Principal = { id: string; fullName: string }
type Relationship = 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER'

const OPEN_LINK_EVENT = 'family-open-reconcile'
const OPEN_PRINCIPALS_EVENT = 'family-open-principals'
const FILTER_SLOT_ID = 'family-admin-filters'
const DEFAULT_REASON = 'Family branch reconciled by Administrator'

export function FamilyAdministrationFilterSlot() {
  return <div id={FILTER_SLOT_ID} className="w-full" />
}
const HEADER_BUTTON = 'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-label-bold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] transition hover:opacity-90 active:scale-[0.98]'

export function FamilyAdministrationActions() {
  return <div className="flex flex-wrap items-center gap-2 sm:justify-end">
    <Link href="/dashboard/member/family?view=mine" className={`${HEADER_BUTTON} bg-primary`}>
      <span className="material-symbols-outlined text-[16px]">family_restroom</span>
      My family
    </Link>
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_PRINCIPALS_EVENT))} className={`${HEADER_BUTTON} bg-primary`}>
      <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
      Principals
    </button>
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_LINK_EVENT))} className={`${HEADER_BUTTON} bg-secondary-container`}>
      <span className="material-symbols-outlined text-[16px]">link</span>
      Link members
    </button>
  </div>
}

export default function FamilyAdministrationClient({ members, principals }: { members: Member[]; principals: Principal[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition()
  const [modal, setModal] = useState<'link' | 'principals' | null>(null)
  const [query, setQuery] = useState(''); const [principalFilter, setPrincipalFilter] = useState(''); const [filter, setFilter] = useState<'ALL' | 'UNASSIGNED' | 'PRINCIPALS' | 'ASSIGNED'>('ALL'); const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [linkPreset, setLinkPreset] = useState<string[]>([])
  const unassigned = members.filter(m => !m.isPrincipal && !m.principalMemberId)
  const filtered = useMemo(() => members.filter(m => { const term = query.trim().toLowerCase(); const match = !term || `${m.fullName} ${m.email} ${m.principalName || ''}`.toLowerCase().includes(term); const group = filter === 'ALL' || (filter === 'UNASSIGNED' && !m.isPrincipal && !m.principalMemberId) || (filter === 'PRINCIPALS' && m.isPrincipal) || (filter === 'ASSIGNED' && !!m.principalMemberId); const branch = !principalFilter || m.id === principalFilter || m.principalMemberId === principalFilter; return match && group && branch }), [members, query, filter, principalFilter])
  const openLink = (ids: string[] = []) => { setLinkPreset(ids); setNotice(''); setModal('link') }
  const run = (work: () => Promise<string | void>, closeAfter = true) => {
    setError(''); setNotice('')
    startTransition(async () => {
      try {
        const message = await work()
        if (message) setNotice(message)
        if (closeAfter) setModal(null)
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the family branch') }
    })
  }
  const friendly = error ? friendlyError(error, 'We could not update this family branch. Please try again.') : null

  useEffect(() => {
    const link = () => openLink()
    const principalsOpen = () => { setNotice(''); setModal('principals') }
    window.addEventListener(OPEN_LINK_EVENT, link)
    window.addEventListener(OPEN_PRINCIPALS_EVENT, principalsOpen)
    return () => { window.removeEventListener(OPEN_LINK_EVENT, link); window.removeEventListener(OPEN_PRINCIPALS_EVENT, principalsOpen) }
  }, [])

  const [filterSlot, setFilterSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setFilterSlot(document.getElementById(FILTER_SLOT_ID)) }, [])

  const stats = [
    { label: 'Members', value: members.length },
    { label: principals.length === 1 ? 'Principal' : 'Principals', value: principals.length },
    { label: 'Assigned', value: members.filter(m => !!m.principalMemberId).length },
    { label: 'Unassigned', value: unassigned.length },
  ]

  const filters = <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <input aria-label="Search members" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members..." className="h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm sm:w-64" />
          <select aria-label="Filter by Principal Member" value={principalFilter} onChange={e => setPrincipalFilter(e.target.value)} className="h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm sm:w-auto">
            <option value="">All Principals</option>
            {principals.map(p => <option key={p.id} value={p.id}>{p.fullName}’s branch</option>)}
          </select>
          <select aria-label="Filter by member assignment" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm sm:w-auto">
            <option value="ALL">All members</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="PRINCIPALS">Principals</option>
            <option value="ASSIGNED">Assigned</option>
          </select>
        </div>

  return <div className="w-full space-y-4 p-4 md:p-6">
    {filterSlot ? createPortal(filters, filterSlot) : filters}
    {notice && !modal && <p role="status" className="flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-medium text-green-800"><span className="material-symbols-outlined text-[18px]">check_circle</span>{notice}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(stat => <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{stat.label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-on-surface">{stat.value}</p>
      </div>)}
    </div>
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
      {/* Phones: one card per member with the Assign / Transfer action. */}
      <ul className="divide-y divide-outline-variant/60 md:hidden">
        {filtered.map(m => <li key={m.id} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-on-surface">{m.fullName}</p>
            <p className="truncate text-xs text-on-surface-variant">{m.relationship || (m.isPrincipal ? 'Principal Member' : 'Member')} · {m.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {m.isPrincipal ? <Badge text="Principal" tone="primary" /> : m.principalName ? <span className="text-xs text-on-surface-variant">Principal: {m.principalName}</span> : <Badge text="Unassigned" tone="warning" />}
              <Badge text={m.status} tone={m.status === 'ACTIVE' ? 'success' : 'neutral'} />
            </div>
          </div>
          {!m.isPrincipal && <button onClick={() => openLink([m.id])} className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold ${m.principalMemberId ? 'border border-secondary-container text-secondary' : 'bg-secondary-container text-on-primary'}`}>{m.principalMemberId ? 'Transfer' : 'Assign'}</button>}
        </li>)}
      </ul>
      <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left text-sm"><thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><tr><th className="p-3">Member</th><th className="p-3">Contact</th><th className="p-3">Principal</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id} className="border-t"><td className="p-3"><b>{m.fullName}</b><p className="text-xs text-on-surface-variant">{m.relationship || (m.isPrincipal ? 'Principal Member' : 'Member')}</p></td><td className="p-3">{m.email}<p className="text-xs text-on-surface-variant">{m.phone || 'No phone'}</p></td><td className="p-3">{m.isPrincipal ? <Badge text="Principal" tone="primary" /> : m.principalName || <Badge text="Unassigned" tone="warning" />}</td><td className="p-3"><Badge text={m.status} tone={m.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td className="p-3">{!m.isPrincipal && <button onClick={() => openLink([m.id])} className={`inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold transition hover:opacity-90 ${m.principalMemberId ? 'border border-secondary-container text-secondary' : 'bg-secondary-container text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)]'}`}>{m.principalMemberId ? 'Transfer' : 'Assign'}</button>}</td></tr>)}</tbody></table></div>
    </section>

    {modal === 'link' && <LinkMembersModal
      members={members}
      principals={principals}
      preset={linkPreset}
      pending={pending}
      onClose={() => !pending && setModal(null)}
      onSubmit={(input) => run(async () => {
        const result = await linkFamilyMembers(input)
        if (result.failed.length) {
          throw new Error(`${result.linked} linked. Could not link ${result.failed.map(f => `${f.name} (${f.message})`).join('; ')}`)
        }
        return `${result.linked} member${result.linked === 1 ? '' : 's'} linked.`
      })}
    />}

    {modal === 'principals' && <PrincipalsModal
      members={members}
      pending={pending}
      notice={notice}
      onClose={() => !pending && setModal(null)}
      onChange={(member, makePrincipal, attachedCount) => run(async () => {
        await setPrincipalStatus({ userId: member.id, isPrincipal: makePrincipal, reason: makePrincipal ? 'Made Principal by Administrator' : 'Principal status removed by Administrator' })
        if (makePrincipal) return `${member.fullName} is now a Principal.`
        return attachedCount
          ? `${member.fullName} is no longer a Principal. ${attachedCount} member${attachedCount === 1 ? ' is' : 's are'} now unassigned.`
          : `${member.fullName} is no longer a Principal.`
      }, false)}
    />}

    {friendly && <ErrorDialog title={friendly.title} message={friendly.message} onClose={() => setError('')} />}
  </div>
}

function ModalFrame({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-2xl bg-surface p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-h3 text-xl text-primary">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-on-surface-variant">{subtitle}</p>}</div>
        <button type="button" onClick={onClose} aria-label="Close"><span className="material-symbols-outlined">close</span></button>
      </div>
      {children}
    </section>
  </div>
}

function LinkMembersModal({ members, principals, preset, pending, onClose, onSubmit }: {
  members: Member[]
  principals: Principal[]
  preset: string[]
  pending: boolean
  onClose: () => void
  onSubmit: (input: { memberIds: string[]; principalId: string; relationship: Relationship; reason: string }) => void
}) {
  const [principalId, setPrincipalId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preset))
  const [search, setSearch] = useState('')
  const [relationship, setRelationship] = useState<Relationship>('OTHER')
  const [reason, setReason] = useState(DEFAULT_REASON)
  const candidates = members.filter(m => !m.isPrincipal && (!principalId || m.principalMemberId !== principalId))
  const visible = candidates.filter(m => !search.trim() || `${m.fullName} ${m.email} ${m.principalName || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const chosen = [...selected].filter(id => candidates.some(m => m.id === id))
  const allVisibleSelected = visible.length > 0 && visible.every(m => selected.has(m.id))
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = () => setSelected(prev => { const next = new Set(prev); visible.forEach(m => allVisibleSelected ? next.delete(m.id) : next.add(m.id)); return next })

  return <ModalFrame title="Link members" subtitle="Link one or many members to a Principal. Members already in another branch are transferred." onClose={onClose}>
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
      <label className="block text-sm font-medium">Principal<select value={principalId} onChange={e => setPrincipalId(e.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3"><option value="">Select Principal</option>{principals.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></label>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Members <span className="font-normal text-on-surface-variant">({chosen.length} selected)</span></span>
          {visible.length > 0 && <button type="button" onClick={toggleAll} className="text-xs font-semibold text-primary hover:underline">{allVisibleSelected ? 'Clear' : 'Select all'}</button>}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." aria-label="Search members to link" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" />
        <ul className="mt-2 min-h-[8rem] flex-1 divide-y divide-outline-variant overflow-y-auto rounded-lg border border-outline-variant">
          {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-on-surface-variant">No members to link.</li>}
          {visible.map(m => <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-container-low">
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} className="h-4 w-4 accent-[#001f50]" />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{m.fullName}</span><span className="block truncate text-xs text-on-surface-variant">{m.principalName ? `In ${m.principalName}’s branch` : 'Unassigned'}</span></span>
            </label>
          </li>)}
        </ul>
      </div>
      <label className="block text-sm font-medium">Relationship<select value={relationship} onChange={e => setRelationship(e.target.value as Relationship)} className="mt-1 h-11 w-full rounded-lg border px-3"><option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="DEPENDENT">Dependent</option><option value="OTHER">Other</option></select></label>
      <label className="block text-sm font-medium">Reason<input value={reason} onChange={e => setReason(e.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3" /></label>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button>
        <button type="button" disabled={pending || !principalId || chosen.length === 0 || reason.trim().length < 5} onClick={() => onSubmit({ memberIds: chosen, principalId, relationship, reason })} className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-40">
          {pending ? 'Linking…' : chosen.length ? `Link ${chosen.length} member${chosen.length === 1 ? '' : 's'}` : 'Link members'}
        </button>
      </div>
    </div>
  </ModalFrame>
}

function PrincipalsModal({ members, pending, notice, onClose, onChange }: {
  members: Member[]
  pending: boolean
  notice: string
  onClose: () => void
  onChange: (member: Member, makePrincipal: boolean, attachedCount: number) => void
}) {
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const attachedCount = (id: string) => members.filter(m => m.principalMemberId === id).length
  const visible = members
    .filter(m => !search.trim() || `${m.fullName} ${m.email}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(b.isPrincipal) - Number(a.isPrincipal) || a.fullName.localeCompare(b.fullName))

  return <ModalFrame title="Principals" subtitle="Make a member a Principal, or demote one. When a Principal is demoted, everyone attached to them is left with no Principal." onClose={onClose}>
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
      {notice && <p role="status" className="flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-medium text-green-800"><span className="material-symbols-outlined text-[18px]">check_circle</span>{notice}</p>}
      {pending && <p className="text-xs font-semibold text-secondary">Saving…</p>}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." aria-label="Search members" className="h-10 w-full rounded-lg border px-3 text-sm" />
      <ul className="min-h-[10rem] flex-1 divide-y divide-outline-variant overflow-y-auto rounded-lg border border-outline-variant">
        {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-on-surface-variant">No members found.</li>}
        {visible.map(m => {
          const count = m.isPrincipal ? attachedCount(m.id) : 0
          return <li key={m.id} className="px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{m.fullName}</span>
                <span className="block truncate text-xs text-on-surface-variant">
                  {m.isPrincipal ? `Principal · ${count} attached` : m.principalName ? `In ${m.principalName}’s branch` : 'Unassigned'}
                  {m.status !== 'ACTIVE' ? ` · ${m.status}` : ''}
                </span>
              </span>
              {m.isPrincipal ? (
                <button type="button" disabled={pending} onClick={() => count ? setConfirming(m.id) : onChange(m, false, 0)} className="shrink-0 rounded-full border border-error/40 px-3 py-1.5 text-xs font-semibold text-error disabled:opacity-40">Demote</button>
              ) : (
                <button type="button" disabled={pending || m.status !== 'ACTIVE'} title={m.status !== 'ACTIVE' ? 'Only active members can be Principals' : undefined} onClick={() => onChange(m, true, 0)} className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-40">Make Principal</button>
              )}
            </div>
            {confirming === m.id && <div className="mt-2 rounded-lg bg-error-container/30 p-2.5 text-xs text-on-surface">
              <p>{count} member{count === 1 ? '' : 's'} attached to {m.fullName} will be left with no Principal.</p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirming(null)} className="rounded-full border px-3 py-1 font-semibold">Cancel</button>
                <button type="button" disabled={pending} onClick={() => { setConfirming(null); onChange(m, false, count) }} className="rounded-full bg-error px-3 py-1 font-semibold text-on-error disabled:opacity-40">Demote</button>
              </div>
            </div>}
          </li>
        })}
      </ul>
      <div className="flex justify-end border-t pt-4"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Done</button></div>
    </div>
  </ModalFrame>
}

function Badge({ text, tone }: { text: string; tone: 'primary' | 'success' | 'warning' | 'neutral' }) { const style = tone === 'primary' ? 'bg-primary text-on-primary' : tone === 'success' ? 'bg-green-100 text-green-800' : tone === 'warning' ? 'bg-secondary/15 text-secondary' : 'bg-surface-container'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${style}`}>{text}</span> }
