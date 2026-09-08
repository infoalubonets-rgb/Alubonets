'use client'

import { useEffect, useRef, useState } from 'react'
import { getActiveEmailSends } from '@/app/actions/email-sends'

type ActiveSend = { id: string; title: string; total: number; sent: number; failed: number; pending: number }

export default function EmailSendProgressBanner({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [sends, setSends] = useState<ActiveSend[]>([])
  const onActiveChangeRef = useRef(onActiveChange)
  onActiveChangeRef.current = onActiveChange

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const active = await getActiveEmailSends()
        if (!cancelled) setSends(active)
      } catch {
        if (!cancelled) setSends([])
      }
    }
    poll()
    const interval = window.setInterval(poll, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    onActiveChangeRef.current?.(sends.length > 0)
  }, [sends.length])

  if (!sends.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[400] flex flex-col items-center gap-1.5 p-2">
      {sends.map((s) => {
        const done = s.sent + s.failed
        const pct = s.total > 0 ? Math.round((done / s.total) * 100) : 0
        return (
          <div
            key={s.id}
            className="pointer-events-auto w-full max-w-xl rounded-xl border border-secondary-container/40 bg-surface px-4 py-2.5 shadow-lg dark:bg-[#0d1729]"
          >
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 truncate font-bold text-on-surface dark:text-blue-50">
                <span className="material-symbols-outlined animate-spin text-secondary" style={{ fontSize: 16 }}>progress_activity</span>
                <span className="truncate">Sending &ldquo;{s.title}&rdquo;…</span>
              </span>
              <span className="shrink-0 text-on-surface-variant">
                {done}/{s.total}{s.failed > 0 ? ` · ${s.failed} failed` : ` · ${pct}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary-container/15">
              <div className="h-full rounded-full bg-secondary-container transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
