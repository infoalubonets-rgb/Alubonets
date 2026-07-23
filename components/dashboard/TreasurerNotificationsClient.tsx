'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'

type Payment = {
  id: string
  createdAt: string
  meta: Prisma.JsonObject
  user: { fullName: string; email: string }
}

const SEEN_KEY = 'treasurer-notif-seen-ts'

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TreasurerNotificationsClient({ payments }: { payments: Payment[] }) {
  const router = useRouter()
  const seenTsRef = useRef<number>(0)

  // Mark all current notifications as seen when this page is mounted
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {}
    seenTsRef.current = Date.now()
    // Fire an event so DashboardShell can clear the badge immediately
    window.dispatchEvent(new CustomEvent('payment-notifications-viewed'))
  }, [])

  // Auto-refresh every 30 s
  useEffect(() => {
    const tid = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 30_000)
    return () => clearInterval(tid)
  }, [router])

  const now = Date.now()
  const cutoff24h = now - 24 * 60 * 60 * 1000

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <span className="material-symbols-outlined icon-fill text-on-surface-variant" style={{ fontSize: 48 }}>notifications_none</span>
        <p className="text-sm text-on-surface-variant">No payment notifications yet.</p>
        <p className="text-[12px] text-on-surface-variant/60">Successful M-Pesa contributions will appear here.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-10">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-on-surface-variant">
          {payments.length} payment{payments.length !== 1 ? 's' : ''} total
          {payments.filter((p) => new Date(p.createdAt).getTime() > cutoff24h).length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
              {payments.filter((p) => new Date(p.createdAt).getTime() > cutoff24h).length} in last 24h
            </span>
          )}
        </p>
        <Link
          href="/dashboard/treasurer/payments"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          Payments dashboard
        </Link>
      </div>

      {/* Feed */}
      {payments.map((p) => {
        const meta = p.meta as { amount?: number; receipt?: string; phone?: string }
        const amount  = meta.amount  ?? 0
        const receipt = meta.receipt ?? ''
        const phone   = meta.phone   ?? ''
        const isNew   = new Date(p.createdAt).getTime() > cutoff24h

        return (
          <div
            key={p.id}
            className={`rounded-2xl border bg-surface-container-lowest flex items-start gap-4 px-4 py-4 transition-colors ${
              isNew
                ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-900/10'
                : 'border-outline-variant'
            }`}
          >
            {/* Icon */}
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isNew ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-surface-container'}`}>
              <span className={`material-symbols-outlined icon-fill ${isNew ? 'text-orange-500' : 'text-on-surface-variant'}`} style={{ fontSize: 20 }}>
                payments
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50">
                    {p.user.fullName}
                    {isNew && (
                      <span className="ml-2 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded-full">NEW</span>
                    )}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">{p.user.email}</p>
                </div>
                <span className="text-[11px] text-on-surface-variant shrink-0">{relativeTime(p.createdAt)}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[15px] font-bold text-secondary dark:text-orange-400">
                  KES {Math.round(amount).toLocaleString()}
                </span>
                {receipt && (
                  <span className="text-[11px] font-mono text-on-surface-variant self-center">{receipt}</span>
                )}
                {phone && (
                  <span className="text-[11px] text-on-surface-variant self-center">{phone}</span>
                )}
              </div>

              <p className="mt-1 text-[11px] text-on-surface-variant">
                {new Date(p.createdAt).toLocaleString('en-KE', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
