'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignFamilyMember, setPrincipalStatus, transferFamilyMember } from '@/app/actions/members'
import ErrorDialog from '@/components/ui/ErrorDialog'
import { friendlyError } from '@/lib/safe-error'

type Member = { id: string; fullName: string; email: string; phone: string | null; lineage: string | null; status: string; isPrincipal: boolean; principalMemberId: string | null; principalName: string | null; relationship: string | null }
type Principal = { id: string; fullName: string }
type Relationship = 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER'

export default function FamilyAdministrationClient({ members, principals }: { members: Member[]; principals: Principal[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false); const [selectedId, setSelectedId] = useState(''); const [principalId, setPrincipalId] = useState('')
  const [relationship, setRelationship] = useState<Relationship>('OTHER'); const [reason, setReason] = useState('Family branch reconciled by Administrator')
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<'ALL' | 'UNASSIGNED' | 'PRINCIPALS' | 'ASSIGNED'>('ALL'); const [error, setError] = useState('')
  const selected = members.find(m => m.id === selectedId); const unassigned = members.filter(m => !m.isPrincipal && !m.principalMemberId)
  const destinations = principals.filter(p => p.id !== selected?.principalMemberId)
  const filtered = useMemo(() => members.filter(m => { const term = query.trim().toLowerCase(); const match = !term || `${m.fullName} ${m.email} ${m.principalName || ''}`.toLowerCase().includes(term); const group = filter === 'ALL' || (filter === 'UNASSIGNED' && !m.isPrincipal && !m.principalMemberId) || (filter === 'PRINCIPALS' && m.isPrincipal) || (filter === 'ASSIGNED' && !!m.principalMemberId); return match && group }), [members, query, filter])
  const showModal = (id = '') => { setSelectedId(id); setPrincipalId(''); setReason('Family branch reconciled by Administrator'); setOpen(true) }
  const run = (work: () => Promise<unknown>) => { setError(''); startTransition(async () => { try { await work(); setOpen(false); setSelectedId(''); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Could not reconcile member') } }) }
  const friendly = error ? friendlyError(error, 'We could not reconcile this member. Please try again.') : null

  return <div className="w-full p-4 md:p-6">
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><h1 className="font-h2 text-2xl text-primary">Members and their Principals</h1><p className="text-sm text-on-surface-variant">{members.length} members · {principals.length} Principals · {unassigned.length} unassigned</p></div>
        <div className="flex flex-wrap items-center gap-2"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members..." className="h-10 rounded-lg border px-3 text-sm" /><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="h-10 rounded-lg border px-3 text-sm"><option value="ALL">All members</option><option value="UNASSIGNED">Unassigned</option><option value="PRINCIPALS">Principals</option><option value="ASSIGNED">Assigned</option></select><button onClick={() => showModal()} className="inline-flex h-10 items-center rounded-lg bg-secondary-container px-4 text-sm font-semibold text-on-primary"><span className="material-symbols-outlined mr-1 align-middle text-[17px]">rule</span>Reconcile members</button></div>
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><tr><th className="p-3">Member</th><th className="p-3">Contact</th><th className="p-3">Lineage</th><th className="p-3">Principal</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id} className="border-t"><td className="p-3"><b>{m.fullName}</b><p className="text-xs text-on-surface-variant">{m.relationship || (m.isPrincipal ? 'Principal Member' : 'Member')}</p></td><td className="p-3">{m.email}<p className="text-xs text-on-surface-variant">{m.phone || 'No phone'}</p></td><td className="p-3 text-xs">{m.lineage || '—'}</td><td className="p-3">{m.isPrincipal ? <Badge text="Principal" tone="primary" /> : m.principalName || <Badge text="Unassigned" tone="warning" />}</td><td className="p-3"><Badge text={m.status} tone={m.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td className="p-3">{!m.isPrincipal && <button onClick={() => showModal(m.id)} className="font-semibold text-primary underline">{m.principalMemberId ? 'Transfer' : 'Assign'}</button>}</td></tr>)}</tbody></table></div>
    </section>

    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget && !pending) setOpen(false) }}><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-h3 text-xl text-primary">Reconcile family member</h2><p className="text-sm text-on-surface-variant">Assign, transfer, or promote a member to Principal.</p></div><button onClick={() => setOpen(false)}><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 space-y-3">
      <label className="block text-sm font-medium">Member<select value={selectedId} onChange={e => { setSelectedId(e.target.value); setPrincipalId('') }} className="mt-1 h-11 w-full rounded-lg border px-3"><option value="">Select member</option>{members.filter(m => !m.isPrincipal).map(m => <option key={m.id} value={m.id}>{m.fullName} — {m.principalName || 'Unassigned'}</option>)}</select></label>
      <label className="block text-sm font-medium">{selected?.principalMemberId ? 'New Principal' : 'Assign to Principal'}<select value={principalId} onChange={e => setPrincipalId(e.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3"><option value="">Select Principal</option>{destinations.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></label>
      <label className="block text-sm font-medium">Relationship<select value={relationship} onChange={e => setRelationship(e.target.value as Relationship)} className="mt-1 h-11 w-full rounded-lg border px-3"><option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="DEPENDENT">Dependent</option><option value="OTHER">Other</option></select></label>
      <label className="block text-sm font-medium">Reason<input value={reason} onChange={e => setReason(e.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3" /></label>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2">Cancel</button>{selected && !selected.principalMemberId && <button disabled={pending || selected.status !== 'ACTIVE'} onClick={() => run(() => setPrincipalStatus({ userId: selected.id, isPrincipal: true, reason }))} className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary disabled:opacity-40">Make Principal</button>}<button disabled={pending || !selected || !principalId || reason.trim().length < 5} onClick={() => selected && run(() => selected.principalMemberId ? transferFamilyMember({ memberId: selected.id, newPrincipalId: principalId, relationship, reason }) : assignFamilyMember({ memberId: selected.id, principalId, relationship, reason }))} className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-40">{pending ? 'Saving...' : selected?.principalMemberId ? 'Transfer member' : 'Assign member'}</button></div>
    </div></section></div>}
    {friendly && <ErrorDialog title={friendly.title} message={friendly.message} onClose={() => setError('')} />}
  </div>
}

function Badge({ text, tone }: { text: string; tone: 'primary' | 'success' | 'warning' | 'neutral' }) { const style = tone === 'primary' ? 'bg-primary text-on-primary' : tone === 'success' ? 'bg-green-100 text-green-800' : tone === 'warning' ? 'bg-secondary/15 text-secondary' : 'bg-surface-container'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${style}`}>{text}</span> }
