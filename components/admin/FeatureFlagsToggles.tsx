'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toggleFeatureFlag } from '@/app/actions/settings'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

type Props = {
  loansEnabled: boolean
  welfareEnabled: boolean
}

function OrangeToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fe8015] disabled:opacity-60 ${
        checked ? 'bg-[#fe8015]' : 'bg-outline-variant'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function FeatureFlagsToggles({ loansEnabled, welfareEnabled }: Props) {
  const [loansOn, setLoansOn] = useState(loansEnabled)
  const [welfareOn, setWelfareOn] = useState(welfareEnabled)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(key: string, enabled: boolean, rollback: () => void) {
    setError(null)
    setPendingKey(key)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set('key', key)
        fd.set('enabled', enabled ? 'true' : 'false')
        await toggleFeatureFlag(fd)
      } catch {
        rollback()
        setError('Could not update that setting. Try again.')
      } finally {
        setPendingKey(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface">Enable loans module</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            When off, loan routes and actions are hidden/blocked. Templates:{' '}
            <Link href="/admin/announcements" className="text-primary underline">
              Announcements
            </Link>
            .
          </p>
        </div>
        <OrangeToggle
          label="Enable loans module"
          checked={loansOn}
          disabled={isPending && pendingKey === FEATURE_FLAGS.loansEnabled}
          onChange={(next) => {
            const prev = loansOn
            setLoansOn(next)
            save(FEATURE_FLAGS.loansEnabled, next, () => setLoansOn(prev))
          }}
        />
      </div>

      <div className="border-t border-outline-variant/60 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface">Enable welfare module</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              When off, the Welfare nav item and routes are hidden for members and treasurers.
            </p>
          </div>
          <OrangeToggle
            label="Enable welfare module"
            checked={welfareOn}
            disabled={isPending && pendingKey === FEATURE_FLAGS.welfareEnabled}
            onChange={(next) => {
              const prev = welfareOn
              setWelfareOn(next)
              save(FEATURE_FLAGS.welfareEnabled, next, () => setWelfareOn(prev))
            }}
          />
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
