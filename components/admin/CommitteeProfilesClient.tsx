'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCommitteeProfile, saveCommitteeProfile } from '@/app/actions/committee'

export type CommitteeRow = {
  id: string
  userId: string | null
  memberName: string | null
  name: string
  position: string
  responsibilities: string | null
  biography: string
  photoUrl: string | null
  displayOrder: number
  published: boolean
}

type MemberOption = { id: string; fullName: string }

const EMPTY: CommitteeRow = {
  id: '',
  userId: null,
  memberName: null,
  name: '',
  position: '',
  responsibilities: '',
  biography: '',
  photoUrl: '',
  displayOrder: 0,
  published: true,
}

export default function CommitteeProfilesClient({ rows, members }: { rows: CommitteeRow[]; members: MemberOption[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<CommitteeRow | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.currentTarget)
    formData.set('published', formData.get('published') ? 'true' : 'false')
    startTransition(async () => {
      const result = await saveCommitteeProfile(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEditing(null)
      router.refresh()
    })
  }

  function remove(row: CommitteeRow) {
    if (!window.confirm(`Remove ${row.name} (${row.position}) from the About page?`)) return
    const formData = new FormData()
    formData.set('id', row.id)
    setError('')
    startTransition(async () => {
      const result = await deleteCommitteeProfile(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-on-surface-variant">
          Executives listed here appear on the public About page in display order. Each linked member chooses which
          extra details (photo, profession, location, contacts) are shown from their own profile page.
        </p>
        <button
          type="button"
          onClick={() => {
            setError('')
            setEditing({ ...EMPTY, displayOrder: rows.length + 1 })
          }}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
        >
          Add executive
        </button>
      </div>

      {error && !editing && <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

      {/* Phones: one card per profile. */}
      <ul className="space-y-2 md:hidden">
        {rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant">
            No executive profiles yet.
          </li>
        )}
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-outline-variant bg-surface p-3 dark:bg-[#0d1729]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-on-surface">
                  <span className="mr-1.5 text-xs text-on-surface-variant">#{row.displayOrder}</span>
                  {row.name}
                </p>
                <p className="truncate text-sm text-on-surface-variant">{row.position}</p>
                {row.memberName && <p className="truncate text-xs text-on-surface-variant">Linked: {row.memberName}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${row.published ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                {row.published ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => { setError(''); setEditing(row) }} className="h-9 flex-1 rounded-full border border-outline-variant text-sm font-semibold text-primary">
                Edit
              </button>
              <button type="button" disabled={pending} onClick={() => remove(row)} className="h-9 flex-1 rounded-full border border-error/40 text-sm font-semibold text-error disabled:opacity-50">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-surface dark:bg-[#0d1729] md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-container-low text-left text-xs uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Linked member</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-on-surface-variant">
                  No executive profiles yet. Until you publish one, the About page shows executives switched on in
                  Members (“Show on About page”), or placeholder names if there are none.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.displayOrder}</td>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{row.position}</td>
                <td className="px-3 py-2">{row.memberName || '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      row.published ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {row.published ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setError('')
                      setEditing(row)
                    }}
                    className="mr-2 text-sm font-semibold text-primary"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(row)}
                    className="text-sm font-semibold text-error disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form
            onSubmit={submit}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl dark:bg-[#0d1729] [&_input:not([type=checkbox])]:bg-surface [&_select]:bg-surface [&_textarea]:bg-surface dark:[&_input:not([type=checkbox])]:bg-[#111f36] dark:[&_select]:bg-[#111f36] dark:[&_textarea]:bg-[#111f36]"
          >
            <h2 className="font-h3 text-lg text-primary">{editing.id ? 'Edit executive' : 'Add executive'}</h2>
            <input type="hidden" name="id" value={editing.id} />
            <label className="block text-sm">
              Member
              <select name="userId" defaultValue={editing.userId ?? ''} className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="">— Not linked to a member —</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Display name
              <input
                name="name"
                defaultValue={editing.name}
                placeholder="Defaults to the member's name"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Title
              <input
                name="position"
                required
                defaultValue={editing.position}
                placeholder="e.g. Chairperson"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Responsibilities
              <textarea
                name="responsibilities"
                rows={4}
                defaultValue={editing.responsibilities ?? ''}
                placeholder="One responsibility per line"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Short biography (optional)
              <textarea name="biography" rows={3} defaultValue={editing.biography} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="block text-sm">
              Photo URL (optional)
              <input
                name="photoUrl"
                type="url"
                defaultValue={editing.photoUrl ?? ''}
                placeholder="https://… (otherwise the member's profile photo is used if they allow it)"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="block text-sm">
                Display order
                <input
                  name="displayOrder"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={editing.displayOrder}
                  className="mt-1 w-24 rounded-lg border px-3 py-2"
                />
              </label>
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input name="published" type="checkbox" defaultChecked={editing.published} className="h-4 w-4 accent-primary" />
                Show on the About page
              </label>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
