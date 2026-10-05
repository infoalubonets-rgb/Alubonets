'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { openCurrentAccountingPeriod } from '@/app/actions/finance'

type Status = { oldMonth: { key: string; label: string } | null; currentLabel?: string }

/** Event fired after an admin opens or closes a month, so the pill updates without a reload. */
export const ACCOUNTING_PERIOD_CHANGED = 'accounting-period-changed'

/** Floating reminder, on every admin page, that an old month is open — with a one-click way back. */
export default function OldMonthPill() {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<Status | null>(null)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/accounting-period')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: Status | null) => { if (!cancelled && data) setStatus(data) })
        .catch(() => {})
    load()
    window.addEventListener(ACCOUNTING_PERIOD_CHANGED, load)
    return () => {
      cancelled = true
      window.removeEventListener(ACCOUNTING_PERIOD_CHANGED, load)
    }
  }, [pathname])

  if (!status?.oldMonth) return null

  async function switchBack() {
    if (switching) return
    setSwitching(true)
    setError('')
    try {
      await openCurrentAccountingPeriod()
      setStatus({ oldMonth: null })
      window.dispatchEvent(new Event(ACCOUNTING_PERIOD_CHANGED))
      router.refresh()
    } catch {
      setError('Could not switch. Try again.')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div
      role="status"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[86] flex w-[calc(100%-7rem)] max-w-md -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-[0_12px_30px_rgba(0,31,80,.18)] dark:border-amber-500/40 dark:bg-[#2a2110] dark:text-amber-100"
    >
      <span className="material-symbols-outlined text-[20px]">history</span>
      <span className="min-w-0 flex-1">
        You are working in{' '}
        <Link href={`/admin/finance?month=${status.oldMonth.key}`} className="font-bold underline">
          {status.oldMonth.label}
        </Link>
        {error && <span className="block text-xs text-red-700 dark:text-red-300">{error}</span>}
      </span>
      <button
        type="button"
        onClick={switchBack}
        disabled={switching}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-label-bold text-on-primary hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {switching && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
        {switching ? 'Switching…' : `Back to ${status.currentLabel?.split(' ')[0] ?? 'current month'}`}
      </button>
    </div>
  )
}
