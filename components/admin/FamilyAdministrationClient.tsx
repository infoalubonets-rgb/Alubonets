'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignFamilyMember, setPrincipalStatus, transferFamilyMember } from '@/app/actions/members'

type Member = { id: string; fullName: string; email: string; phone: string | null; lineage: string | null; status: string; isPrincipal: boolean; principalMemberId: string | null; principalName: string | null; relationship: string | null }
type Principal = { id: string; fullName: string }
type Relationship = 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER'

export default function FamilyAdministrationClient({ members, principals }: { members: Member[]; principals: Principal[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState('')
  const [principalId, setPrincipalId] = useState('')
  const [relationship, setRelationship] = useState<Relationship>('OTHER')
  const [reason, setReason] = useState('Family branch assigned by Administrator')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'UNASSIGNED' | 'PRINCIPALS' | 'ASSIGNED'>('ALL')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const selected = members.find((member) => member.id === selectedId)
  const unassigned = members.filter((member) => !member.isPrincipal && !member.principalMemberId)
  const assigned = members.filter((member) => !member.isPrincipal && Boolean(member.principalMemberId))
  const filtered = useMemo(() => members.filter((member) => {
    const term = query.trim().toLowerCase()
    const matches = !term || `${member.fullName} ${member.email} ${member.phone || ''} ${member.principalName || ''}`.toLowerCase().includes(term)
    const group = filter === 'ALL' || (filter === 'UNASSIGNED' && !member.isPrincipal && !member.principalMemberId) || (filter === 'PRINCIPALS' && member.isPrincipal) || (filter === 'ASSIGNED' && Boolean(member.principalMemberId))
    return matches && group
  }), [members, query, filter])
  const destinations = principals.filter((principal) => principal.id !== selected?.principalMemberId)

  const run = (work: () => Promise<unknown>, success: string) => {
    setError(''); setMessage('')
    startTransition(async () => {
      try { await work(); setMessage(success); setSelectedId(''); setPrincipalId(''); router.refresh() }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Family administration update failed') }
    })
  }

  return <div className="w-full space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-secondary">Administration</p><h1 className="font-h2 text-3xl text-primary">Family Directory</h1><p className="mt-1 text-sm text-on-surface-variant">Every non-Principal member should belong to one Principal branch.</p></div>
      <div className="flex gap-2 text-center">
        <Stat label="Principals" value={principals.length} tone="primary" />
        <Stat label="Assigned" value={assigned.length} tone="success" />
        <Stat label="Need assignment" value={unassigned.length} tone={unassigned.length ? 'warning' : 'success'} />
      </div>
    </header>

    <section className={`rounded-2xl border p-5 ${unassigned.length ? 'border-secondary/40 bg-secondary/5' : 'border-outline-variant bg-surface'}`}>
      <div className="flex items-start gap-3"><span className="material-symbols-outlined rounded-full bg-secondary/15 p-2 text-secondary">family_restroom</span><div><h2 className="font-h3 text-lg text-primary">Resolve branch ownership</h2><p className="text-sm text-on-surface-variant">Select an unassigned member, then attach them to a Principal or make them a Principal.</p></div></div>
      {unassigned.length ? <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setPrincipalId('') }} className="h-11 rounded-lg border bg-surface px-3 text-sm"><option value="">Select unassigned member</option>{unassigned.map((m) => <option key={m.id} value={m.id}>{m.fullName} — {m.email}</option>)}</select>
        <select value={principalId} onChange={(e) => setPrincipalId(e.target.value)} className="h-11 rounded-lg border bg-surface px-3 text-sm"><option value="">Assign to Principal</option>{principals.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select>
        <select value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)} className="h-11 rounded-lg border bg-surface px-3 text-sm"><option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="DEPENDENT">Dependent</option><option value="OTHER">Other</option></select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-lg border bg-surface px-3 text-sm lg:col-span-2" placeholder="Reason for assignment" />
        <div className="flex gap-2"><button disabled={pending || !selectedId || !principalId || reason.trim().length < 5} onClick={() => run(() => assignFamilyMember({ memberId: selectedId, principalId, relationship, reason }), 'Member assigned to Principal branch.')} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-40">Assign branch</button><button disabled={pending || !selectedId || selected?.status !== 'ACTIVE'} onClick={() => run(() => setPrincipalStatus({ userId: selectedId, isPrincipal: true, reason: 'Promoted from Family Directory' }), 'Member promoted to Principal.')} className="flex-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40">Make Principal</button></div>
      </div> : <p className="mt-4 rounded-lg bg-primary/5 p-3 text-sm font-medium text-primary">All non-Principal members have a branch owner.</p>}
      {error && <p className="mt-3 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}{message && !error && <p className="mt-3 rounded-lg bg-primary/5 p-3 text-sm text-primary">{message}</p>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-h3 text-lg text-primary">Members and branch owners</h2><p className="text-xs text-on-surface-variant">{filtered.length} of {members.length} members</p></div><div className="flex flex-wrap gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members..." className="h-9 rounded-lg border px-3 text-sm" /><select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-9 rounded-lg border px-3 text-sm"><option value="ALL">All members</option><option value="UNASSIGNED">Need assignment</option><option value="PRINCIPALS">Principals</option><option value="ASSIGNED">Assigned members</option></select></div></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><tr><th className="p-3">Member</th><th className="p-3">Contact</th><th className="p-3">Lineage</th><th className="p-3">Principal / branch</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{filtered.map((member) => <tr key={member.id} className="border-t border-outline-variant/50"><td className="p-3"><p className="font-semibold">{member.fullName}</p><p className="text-xs text-on-surface-variant">{member.relationship || (member.isPrincipal ? 'Principal Member' : 'Member')}</p></td><td className="p-3"><p>{member.email}</p><p className="text-xs text-on-surface-variant">{member.phone || 'No phone'}</p></td><td className="max-w-48 p-3 text-xs">{member.lineage || '—'}</td><td className="p-3">{member.isPrincipal ? <Badge text="Principal" tone="primary" /> : member.principalName ? member.principalName : <Badge text="Unassigned" tone="warning" />}</td><td className="p-3"><Badge text={member.status} tone={member.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td className="p-3">{!member.isPrincipal && <button onClick={() => { setSelectedId(member.id); setPrincipalId(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs font-semibold text-primary underline">{member.principalMemberId ? 'Transfer' : 'Assign'}</button>}</td></tr>)}</tbody></table></div>
    </section>

    {selected?.principalMemberId && <section className="rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-lg text-primary">Transfer {selected.fullName}</h2><div className="mt-3 grid gap-3 md:grid-cols-4"><select value={principalId} onChange={(e) => setPrincipalId(e.target.value)} className="h-10 rounded-lg border px-3 text-sm"><option value="">New Principal</option>{destinations.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select><select value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)} className="h-10 rounded-lg border px-3 text-sm"><option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="DEPENDENT">Dependent</option><option value="OTHER">Other</option></select><input value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 rounded-lg border px-3 text-sm" /><button disabled={!principalId || reason.trim().length < 5 || pending} onClick={() => run(() => transferFamilyMember({ memberId: selected.id, newPrincipalId: principalId, relationship, reason }), 'Member transferred successfully.')} className="rounded-lg bg-secondary-container px-4 text-sm font-semibold text-on-primary disabled:opacity-40">Transfer member</button></div></section>}
  </div>
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'success' | 'warning' }) { const styles = tone === 'warning' ? 'bg-secondary/10 text-secondary' : tone === 'success' ? 'bg-green-50 text-green-700' : 'bg-primary/5 text-primary'; return <div className={`min-w-24 rounded-xl px-4 py-2 ${styles}`}><p className="text-xl font-bold">{value}</p><p className="text-[10px] font-bold uppercase">{label}</p></div> }
function Badge({ text, tone }: { text: string; tone: 'primary' | 'success' | 'warning' | 'neutral' }) { const styles = tone === 'primary' ? 'bg-primary text-on-primary' : tone === 'success' ? 'bg-green-100 text-green-800' : tone === 'warning' ? 'bg-secondary/15 text-secondary' : 'bg-surface-container text-on-surface-variant'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${styles}`}>{text}</span> }
