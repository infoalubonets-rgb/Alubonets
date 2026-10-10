'use client'

import { useEffect, useRef, useState } from 'react'
import type { ActiveEmailSend as Send } from '@/lib/email-sends'

async function fetchActiveSends(): Promise<Send[]> {
  const res = await fetch('/api/email-sends/active', { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as { sends?: Send[] }
  return data.sends ?? []
}

/** Fired by the composer when a notification is sent, so progress shows immediately. */
export const EMAIL_SEND_STARTED_EVENT = 'email-send-started'

const FAST_MS = 1500
const IDLE_MS = 15_000

/** Live "Sending… 4/11" banner for admin notification emails, ending with the final result. */
export default function EmailSendProgressBanner({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [sends, setSends] = useState<Send[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [starting, setStarting] = useState(false)
  const onActiveChangeRef = useRef(onActiveChange)
  onActiveChangeRef.current = onActiveChange
  const fastUntil = useRef(0)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const poll = async () => {
      if (document.visibilityState === 'visible' || Date.now() < fastUntil.current) {
        try {
          const active = await fetchActiveSends()
          if (cancelled) return
          setSends(active)
          if (active.length) setStarting(false)
          if (active.some((s) => !s.finished)) fastUntil.current = Date.now() + 5_000
        } catch {
          // Network blip or server restart: keep the last state and retry on the next tick.
        }
      }
      if (!cancelled) timer = window.setTimeout(poll, Date.now() < fastUntil.current ? FAST_MS : IDLE_MS)
    }
    const onStarted = () => {
      // Show the spinner straight away and check every 1.5 s until the send finishes.
      setStarting(true)
      fastUntil.current = Date.now() + 30_000
      window.clearTimeout(timer)
      timer = window.setTimeout(poll, 800)
      window.setTimeout(() => setStarting(false), 30_000)
    }
    poll()
    window.addEventListener(EMAIL_SEND_STARTED_EVENT, onStarted)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener(EMAIL_SEND_STARTED_EVENT, onStarted)
    }
  }, [])

  const visible = sends.filter((s) => !dismissed.has(s.id))
  const sending = sends.some((s) => !s.finished)

  useEffect(() => {
    onActiveChangeRef.current?.(sending)
  }, [sending])

  if (!visible.length && !starting) return null

  return (
    <div className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 z-[400] flex w-[calc(100%-6.5rem)] max-w-xs flex-col gap-2 sm:left-5">
      {!visible.length && starting && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-secondary-container/40 bg-surface p-3 shadow-[0_12px_30px_rgba(0,31,80,.18)] dark:bg-[#0d1729]">
          <ProgressRing pct={0} spinning />
          <p className="text-[13px] font-bold text-on-surface dark:text-blue-50">Preparing emails…</p>
        </div>
      )}
      {visible.map((s) => {
        const done = s.sent + s.failed
        const pct = s.total > 0 ? Math.round((done / s.total) * 100) : 0
        const allFailed = s.finished && s.sent === 0 && s.failed > 0
        const tone = s.finished ? (s.failed > 0 ? 'red' : 'green') : 'orange'
        return (
          <div
            key={s.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl border bg-surface p-3 shadow-[0_12px_30px_rgba(0,31,80,.18)] dark:bg-[#0d1729] ${
              tone === 'red' ? 'border-red-300' : tone === 'green' ? 'border-green-300' : 'border-secondary-container/40'
            }`}
          >
            <ProgressRing pct={s.finished ? 100 : pct} tone={tone} icon={s.finished ? (allFailed ? 'error' : s.failed > 0 ? 'warning' : 'check') : undefined} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-on-surface dark:text-blue-50">
                {s.finished ? (allFailed ? 'Emails failed' : 'Emails sent') : 'Sending emails…'}
              </p>
              <p className="truncate text-[11px] text-on-surface-variant">&ldquo;{s.title}&rdquo;</p>
              <p className="text-[11px] text-on-surface-variant">
                {s.sent}/{s.total} delivered
                {s.failed > 0 && <span className="font-bold text-red-600"> · {s.failed} failed</span>}
              </p>
            </div>
            {s.finished && (
              <button type="button" onClick={() => setDismissed((d) => new Set(d).add(s.id))} aria-label="Dismiss" className="self-start rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const RING = { orange: '#fe8015', green: '#16a34a', red: '#dc2626' }

/** Circular progress: the ring fills as emails go out; a tick or warning when finished. */
function ProgressRing({ pct, tone = 'orange', icon, spinning = false }: { pct: number; tone?: keyof typeof RING; icon?: string; spinning?: boolean }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className={`absolute inset-0 -rotate-90 ${spinning ? 'animate-spin' : ''}`} aria-hidden="true">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-outline-variant/40" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={RING[tone]}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={spinning ? circumference * 0.7 : circumference * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {icon ? (
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: RING[tone] }}>{icon}</span>
      ) : (
        !spinning && <span className="text-[10px] font-bold text-on-surface dark:text-blue-50">{pct}%</span>
      )}
    </span>
  )
}
