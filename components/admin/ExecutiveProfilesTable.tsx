'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import IconModalButton from '@/components/ui/IconModalButton'
import ExecutiveAboutSettings from './ExecutiveAboutSettings'
import { setAboutProfile } from '@/app/actions/members'

export type ExecutiveProfileRow = {
  id: string; fullName: string; email: string; phone: string | null; location: string | null; profession: string | null; photoUrl: string | null; status: string
  biography: string; responsibilities: string
  extraDetails: Record<string, string | null>
  about: { show: boolean; title: string | null; order: number; fields: string[] }
}

function ExecutiveRow({ row }: { row: ExecutiveProfileRow }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()
  return <tr className="border-t border-outline-variant">
    <td className="p-3"><div className="flex items-center gap-3">{row.photoUrl && <img src={row.photoUrl} alt={row.fullName} className="h-12 w-12 rounded-full object-cover" />}<div className="min-w-0"><p className="font-semibold">{row.fullName}</p><p className="break-all text-xs text-on-surface-variant">{row.email}</p><p className="text-xs text-on-surface-variant">{row.status}</p></div></div>{error && <p role="alert" className="text-sm text-error">{error}</p>}</td>
    <td className="p-3">{row.about.title || 'Executive Committee'}</td>
    <td className="p-3">{row.about.order}</td>
    <td className="p-3"><input type="checkbox" role="switch" aria-label={`Show ${row.fullName} on About Us`} checked={row.about.show} disabled={pending || row.status !== 'ACTIVE'} className="h-5 w-5 accent-orange-500" onChange={e => {
      const show = e.target.checked
      setError('')
      start(async () => { try { await setAboutProfile({ userId: row.id, showOnAbout: show, aboutTitle: row.about.title || undefined, aboutOrder: row.about.order, fields: row.about.fields }); router.refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save.') } })
    }} /></td>
    <td className="p-3"><IconModalButton icon="visibility" label={`View and edit ${row.fullName}`} title={row.fullName} size="wide">
      <div className="space-y-4">
        {row.photoUrl && <img src={row.photoUrl} alt={row.fullName} className="h-32 w-32 rounded-full object-cover" />}
        <dl className="grid gap-3 sm:grid-cols-2">{[['Name', row.fullName], ['Email', row.email], ['Phone', row.phone], ['Profession', row.profession], ['Location', row.location], ['Account status', row.status]].map(([label, value]) => <div key={label}><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="break-words text-sm">{value || '—'}</dd></div>)}</dl>
        <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row.extraDetails).map(([label, value]) => <div key={label}><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="break-words text-sm">{value || '—'}</dd></div>)}</dl>
        <ExecutiveAboutSettings key={`${row.id}-${JSON.stringify(row.about)}-${row.biography}-${row.responsibilities}`} userId={row.id} about={row.about} biography={row.biography} responsibilities={row.responsibilities} />
      </div>
    </IconModalButton></td>
  </tr>
}

export default function ExecutiveProfilesTable({ rows }: { rows: ExecutiveProfileRow[] }) {
  const [search, setSearch] = useState('')
  const filtered = rows.filter(row => `${row.fullName} ${row.email} ${row.about.title || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-4"><input aria-label="Search executives" placeholder="Search name, email or position" className="w-full rounded-xl border p-3 sm:max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="overflow-x-auto rounded-xl border border-outline-variant"><table className="w-full text-left text-sm"><thead className="bg-surface-container-low"><tr>{['Executive', 'Position', 'Order', 'Public', 'Details'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{filtered.map(row => <ExecutiveRow key={row.id} row={row} />)}</tbody></table>{!filtered.length && <p className="p-6 text-center text-on-surface-variant">No Executive accounts found.</p>}</div>
  </div>
}
