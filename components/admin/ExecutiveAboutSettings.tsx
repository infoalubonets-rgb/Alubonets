'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAboutProfile } from '@/app/actions/members'
import { PUBLIC_PROFILE_FIELDS } from '@/lib/public-profile'

type About = { show: boolean; title: string | null; order: number; fields: string[] }

/** Admin-only: whether this executive appears on the public About page and which details are shown. */
export default function ExecutiveAboutSettings({ userId, about, biography, responsibilities }: { userId: string; about: About; biography?: string; responsibilities?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [show, setShow] = useState(about.show)
  const [title, setTitle] = useState(about.title ?? '')
  const [order, setOrder] = useState(String(about.order))
  const [fields, setFields] = useState<string[]>(about.fields)
  const [error, setError] = useState('')
  const [bio, setBio] = useState(biography ?? '')
  const [duties, setDuties] = useState(responsibilities ?? '')
  const [ok, setOk] = useState('')

  const toggleField = (key: string, on: boolean) =>
    setFields((current) => (on ? [...current, key] : current.filter((value) => value !== key)))

  const save = () => {
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await setAboutProfile({ userId, showOnAbout: show, aboutTitle: title.trim() || undefined, aboutOrder: Number(order) || 0, fields, ...(biography !== undefined ? { biography: bio, responsibilities: duties } : {}) })
        setOk(show ? 'Shown on the About page' : 'Hidden from the About page')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save About page settings')
      }
    })
  }

  return (
    <section className="mt-4 space-y-3 border-t border-outline-variant pt-3">
      <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary">About page</p>
      <label className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Show on the public About page</span>
          <span className="block text-[11px] text-on-surface-variant">
            {show ? 'Listed under Executive Committee on the website.' : 'Hidden — executives are not shown until you switch this on.'}
          </span>
        </span>
        <input type="checkbox" className="mt-1 h-4 w-4" checked={show} disabled={pending} onChange={(e) => setShow(e.target.checked)} />
      </label>

      <div className="grid grid-cols-[1fr_90px] gap-2">
        <label className="block text-[11px] font-semibold text-on-surface-variant">
          Position
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Chairperson" className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="block text-[11px] font-semibold text-on-surface-variant">
          Order
          <input type="number" min={0} max={999} value={order} onChange={(e) => setOrder(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold text-on-surface-variant">Details shown on the About page</p>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {PUBLIC_PROFILE_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={fields.includes(field.key)} disabled={pending} onChange={(e) => toggleField(field.key, e.target.checked)} />
              {field.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-on-surface-variant">Name and title are always shown. Everything else stays private unless ticked.</p>
      </div>
      {biography !== undefined && <div className="space-y-3">
        <label className="block text-sm font-semibold">Biography<textarea rows={4} maxLength={5000} value={bio} onChange={e => setBio(e.target.value)} className="mt-1 block w-full rounded-lg border p-3 font-normal" /></label>
        <label className="block text-sm font-semibold">Responsibilities (one per line)<textarea rows={4} maxLength={5000} value={duties} onChange={e => setDuties(e.target.value)} className="mt-1 block w-full rounded-lg border p-3 font-normal" /></label>
      </div>}

      <button type="button" disabled={pending} onClick={save} className="h-10 w-full rounded-full bg-primary text-sm font-label-bold text-on-primary disabled:opacity-50">
        {pending ? 'Saving…' : 'Save About page settings'}
      </button>
      {error && <p className="rounded-xl bg-error-container/40 px-3 py-2 text-center text-sm text-error">{error}</p>}
      {ok && !error && <p className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-center text-sm text-primary">{ok}</p>}
    </section>
  )
}
