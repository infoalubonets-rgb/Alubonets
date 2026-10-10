'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { setAboutProfiles } from '@/app/actions/members'
import { PUBLIC_PROFILE_FIELDS } from '@/lib/public-profile'

export type AboutExecutive = {
  id: string
  fullName: string
  roleLabel: string
  hasPhoto: boolean
  profession: string | null
  location: string | null
  email: string | null
  phone: string | null
  about: { show: boolean; title: string | null; order: number; fields: string[] }
}

type Draft = { show: boolean; title: string; order: string; fields: string[] }

const toDraft = (exec: AboutExecutive): Draft => ({
  show: exec.about.show,
  title: exec.about.title ?? '',
  order: String(exec.about.order),
  fields: exec.about.fields,
})

const sameDraft = (a: Draft, b: Draft) =>
  a.show === b.show &&
  a.title.trim() === b.title.trim() &&
  (Number(a.order) || 0) === (Number(b.order) || 0) &&
  a.fields.length === b.fields.length &&
  a.fields.every((field) => b.fields.includes(field))

function fieldValue(exec: AboutExecutive, key: string) {
  if (key === 'photo') return exec.hasPhoto ? 'Photo uploaded' : null
  if (key === 'profession') return exec.profession
  if (key === 'location') return exec.location
  if (key === 'email') return exec.email
  if (key === 'phone') return exec.phone
  return null
}

/** Admin: pick which executives appear on the public About page and which of their details show. */
export default function ExecutivesAboutButton({
  executives,
  className,
  publishedProfiles,
}: {
  executives: AboutExecutive[]
  className: string
  /** Published Communications → About Us profiles replace this list on the website. */
  publishedProfiles: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const initial = useMemo(() => Object.fromEntries(executives.map((exec) => [exec.id, toDraft(exec)])), [executives])
  const draftFor = (id: string) => drafts[id] ?? initial[id]
  const update = (id: string, patch: Partial<Draft>) => {
    setMessage('')
    setDrafts((current) => ({ ...current, [id]: { ...draftFor(id), ...patch } }))
  }
  const dirtyIds = executives.filter((exec) => !sameDraft(draftFor(exec.id), initial[exec.id])).map((exec) => exec.id)
  const shownCount = executives.filter((exec) => draftFor(exec.id).show).length

  const openModal = () => {
    setDrafts({})
    setError('')
    setMessage('')
    setOpen(true)
  }

  const save = () => {
    setError('')
    setMessage('')
    startTransition(async () => {
      try {
        const { changed } = await setAboutProfiles(
          dirtyIds.map((id) => {
            const draft = draftFor(id)
            return {
              userId: id,
              showOnAbout: draft.show,
              aboutTitle: draft.title.trim() || undefined,
              aboutOrder: Math.min(999, Math.max(0, Math.round(Number(draft.order) || 0))),
              fields: draft.fields,
            }
          }),
        )
        setMessage(changed ? `Saved ${changed} executive${changed === 1 ? '' : 's'}. The About page is updated.` : 'Nothing to save.')
        setDrafts({})
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the About page selection.')
      }
    })
  }

  return (
    <>
      <button type="button" onClick={openModal} className={className}>
        <span className="material-symbols-outlined text-[16px]">groups</span>
        Executives
      </button>
      <FullScreenModal open={open} title="Executives on the About page" onClose={() => !pending && setOpen(false)} size="wide">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-low px-3 py-2.5 text-xs text-on-surface-variant">
            <p>
              Switch on the executives to list under <b>Executive Committee</b> on the public About page, and tick which details
              the public may see. Name and title are always shown. {shownCount} of {executives.length} selected.
            </p>
            <Link href="/about" target="_blank" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              View About page
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </Link>
          </div>

          {publishedProfiles > 0 && (
            <p className="rounded-xl border border-secondary-container/50 bg-secondary-fixed/40 px-3 py-2.5 text-xs text-on-surface">
              {publishedProfiles} About Us profile{publishedProfiles === 1 ? ' is' : 's are'} published under Communications. The website
              shows those instead of this list until they are unpublished.
            </p>
          )}

          {executives.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant px-4 py-8 text-center text-sm text-on-surface-variant">
              No active executives yet. Give members the Executive role (main or second role) on the Roles page first.
            </p>
          ) : (
            <ul className="space-y-3">
              {executives.map((exec) => {
                const draft = draftFor(exec.id)
                const preview = draft.fields
                  .filter((key) => key !== 'photo')
                  .map((key) => fieldValue(exec, key))
                  .filter((value): value is string => Boolean(value))
                return (
                  <li
                    key={exec.id}
                    className={`rounded-2xl border p-4 transition ${draft.show ? 'border-primary/40 bg-surface' : 'border-outline-variant bg-surface-container-lowest'}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface">{exec.fullName}</p>
                        <p className="text-[11px] text-on-surface-variant">{exec.roleLabel}</p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <span className={draft.show ? 'text-primary' : 'text-on-surface-variant'}>
                          {draft.show ? 'Shown on About page' : 'Hidden'}
                        </span>
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#001f50]"
                          checked={draft.show}
                          disabled={pending}
                          onChange={(e) => update(exec.id, { show: e.target.checked })}
                        />
                      </label>
                    </div>

                    <div className={`mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr] ${draft.show ? '' : 'opacity-60'}`}>
                      <div className="grid grid-cols-[1fr_80px] gap-2 self-start">
                        <label className="block text-[11px] font-semibold text-on-surface-variant">
                          Title shown
                          <input
                            value={draft.title}
                            maxLength={80}
                            disabled={pending}
                            onChange={(e) => update(exec.id, { title: e.target.value })}
                            placeholder="e.g. Chairperson"
                            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-[11px] font-semibold text-on-surface-variant">
                          Order
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={draft.order}
                            disabled={pending}
                            onChange={(e) => update(exec.id, { order: e.target.value })}
                            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-on-surface-variant">Details shown to the public</p>
                        <div className="flex flex-wrap gap-1.5">
                          {PUBLIC_PROFILE_FIELDS.map((field) => {
                            const on = draft.fields.includes(field.key)
                            const missing = !fieldValue(exec, field.key)
                            return (
                              <label
                                key={field.key}
                                title={missing ? 'Not filled in on their profile yet' : undefined}
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                  on ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5"
                                  checked={on}
                                  disabled={pending}
                                  onChange={(e) =>
                                    update(exec.id, {
                                      fields: e.target.checked ? [...draft.fields, field.key] : draft.fields.filter((value) => value !== field.key),
                                    })
                                  }
                                />
                                {field.label}
                                {missing && <span className="text-[10px] text-on-surface-variant">(empty)</span>}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {draft.show && (
                      <p className="mt-3 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                        <span className="font-semibold text-on-surface">Public sees:</span> {exec.fullName} ·{' '}
                        {draft.title.trim() || 'Executive Committee'}
                        {preview.length > 0 && ` · ${preview.join(' · ')}`}
                        {draft.fields.includes('photo') && (exec.hasPhoto ? ' · with photo' : ' · default photo (none uploaded)')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-outline-variant bg-surface pt-3">
            <button
              type="button"
              disabled={pending || dirtyIds.length === 0}
              onClick={save}
              className="h-10 rounded-full bg-primary px-5 text-sm font-label-bold text-on-primary disabled:opacity-50"
            >
              {pending ? 'Saving…' : dirtyIds.length ? `Save ${dirtyIds.length} change${dirtyIds.length === 1 ? '' : 's'}` : 'No changes'}
            </button>
            {dirtyIds.length > 0 && !pending && (
              <button type="button" onClick={() => setDrafts({})} className="text-sm text-on-surface-variant hover:underline">
                Undo changes
              </button>
            )}
            {message && <p className="text-sm text-green-700">{message}</p>}
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        </div>
      </FullScreenModal>
    </>
  )
}
