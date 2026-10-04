'use client'

import { useState } from 'react'
import { updateMyPublicProfileFields } from '@/app/actions/profile'
import { PUBLIC_PROFILE_FIELDS } from '@/lib/public-profile'

export default function PublicProfileFieldsForm({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]))

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      await updateMyPublicProfileFields(selected)
      setMessage('Saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-4 rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Public profile</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        If you are listed as an executive on the public About page, only the details you tick here are shown next to
        your name and title.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {PUBLIC_PROFILE_FIELDS.map((field) => (
          <label key={field.key} className="flex items-center gap-1.5 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={selected.includes(field.key)}
              onChange={() => toggle(field.key)}
              className="h-4 w-4 accent-primary"
            />
            {field.label}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save public profile'}
        </button>
        {message && <p className="text-sm">{message}</p>}
      </div>
    </section>
  )
}
