'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { updateAppSetting } from '@/app/actions/settings'

type Props = {
  settingKey: string
  label: string
  defaultValue: string
  type?: string
  min?: string
  max?: string
  step?: string
}

export default function AppSettingForm({
  settingKey,
  label,
  defaultValue,
  type = 'text',
  min,
  max,
  step,
}: Props) {
  const [value, setValue] = useState(defaultValue)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set('key', settingKey)
        formData.set('value', value)
        await updateAppSetting(formData)
        setMessage('Setting saved.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save setting. Try again.')
      }
    })
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label className="block text-sm">
        {label}
        <input
          name="value"
          type={type}
          min={min}
          max={max}
          step={step}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        {message && <p role="status" className="text-xs text-green-700">{message}</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </form>
  )
}
