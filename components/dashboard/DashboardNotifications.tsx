'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type NotifItem = {
  id: string
  type: 'event' | 'project' | 'gallery' | 'payment'
  title: string
  description: string
  imageUrl: string | null
  href: string
  createdAt: string
}

type CleanupCounts = {
  announcements: number
  pastEvents: number
  oldGallery: number
}

const SEEN_KEY    = 'alubonets-notif-seen-v1'
const CLEANUP_KEY = 'alubonets-cleanup-reminded'
const SEEN_TTL    = 7  * 24 * 60 * 60 * 1000  // 7 days — once dismissed, gone for a week
const ITEM_TTL    = 48 * 60 * 60 * 1000        // 48 hrs — server only returns items this fresh
const REMIND_TTL  = 24 * 60 * 60 * 1000        // 24 hrs — cleanup reminder cadence

function getSeenMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') }
  catch { return {} }
}

function saveSeen(map: Record<string, number>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(map))
}

function markSeen(id: string) {
  const map = getSeenMap()
  map[id] = Date.now()
  const cutoff = Date.now() - ITEM_TTL
  for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k]
  saveSeen(map)
}

function isRecentlySeen(id: string): boolean {
  const ts = getSeenMap()[id]
  return !!ts && Date.now() - ts < SEEN_TTL
}

function shouldShowCleanupReminder(): boolean {
  try {
    const last = Number(localStorage.getItem(CLEANUP_KEY) || '0')
    return Date.now() - last > REMIND_TTL
  } catch { return false }
}

function dismissCleanupReminder() {
  try { localStorage.setItem(CLEANUP_KEY, String(Date.now())) } catch {}
}

const CFG = {
  event:   { icon: 'event',         label: 'New event',       bg: 'bg-primary/10',     color: 'text-primary' },
  project: { icon: 'work',          label: 'New project',     bg: 'bg-green-100 dark:bg-green-900/20',   color: 'text-green-700 dark:text-green-400' },
  gallery: { icon: 'photo_library', label: 'New photo',       bg: 'bg-purple-100 dark:bg-purple-900/20', color: 'text-purple-700 dark:text-purple-400' },
  payment: { icon: 'payments',      label: 'New contribution', bg: 'bg-orange-100 dark:bg-orange-900/20', color: 'text-orange-600 dark:text-orange-400' },
}

export default function DashboardNotifications() {
  const [items, setItems] = useState<NotifItem[]>([])
  const [cleanupCounts, setCleanupCounts] = useState<CleanupCounts>({ announcements: 0, pastEvents: 0, oldGallery: 0 })
  const [showCleanup, setShowCleanup] = useState(false)

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        const { items: fetched = [], announcementCount = 0, pastEventsCount = 0, oldGalleryCount = 0 } = data as {
          items: NotifItem[]
          announcementCount: number
          pastEventsCount: number
          oldGalleryCount: number
        }
        const unseen = fetched.filter((i) => !isRecentlySeen(i.id))
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id))
          const newItems = unseen.filter((i) => !existingIds.has(i.id))
          return newItems.length > 0 ? [...newItems, ...prev] : prev
        })
        const hasCleanup = (announcementCount > 0 || pastEventsCount > 0 || oldGalleryCount > 0) && shouldShowCleanupReminder()
        if (hasCleanup) {
          setCleanupCounts({ announcements: announcementCount, pastEvents: pastEventsCount, oldGallery: oldGalleryCount })
          setShowCleanup(true)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 s to pick up items added while the user is already on the dashboard
    const interval = window.setInterval(fetchNotifications, 30_000)
    // Event dispatched by dashboard components after creating a project/event
    window.addEventListener('check-notifications', fetchNotifications)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('check-notifications', fetchNotifications)
    }
  }, [fetchNotifications])

  const dismiss = useCallback((id: string) => {
    markSeen(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setItems((prev) => { prev.forEach((i) => markSeen(i.id)); return [] })
    setShowCleanup(false)
    dismissCleanupReminder()
  }, [])

  const handleDismissCleanup = useCallback(() => {
    dismissCleanupReminder()
    setShowCleanup(false)
  }, [])

  const hasAny = items.length > 0 || showCleanup
  if (!hasAny) return null

  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 w-[300px]">
      {(items.length > 1 || (items.length > 0 && showCleanup)) && (
        <div className="flex justify-end">
          <button
            onClick={dismissAll}
            className="text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full border border-outline-variant/40 shadow-sm"
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* Cleanup reminder card */}
      {showCleanup && (
        <CleanupCard counts={cleanupCounts} onDismiss={handleDismissCleanup} />
      )}

      {items.slice(0, 4).map((item) => (
        <NotifCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  )
}

function CleanupCard({ counts, onDismiss }: { counts: CleanupCounts; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 15_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const lines: { label: string; count: number; href: string }[] = []
  if (counts.announcements > 0) lines.push({ label: `${counts.announcements} old announcement${counts.announcements > 1 ? 's' : ''}`, count: counts.announcements, href: '/announcements' })
  if (counts.pastEvents > 0) lines.push({ label: `${counts.pastEvents} past event${counts.pastEvents > 1 ? 's' : ''}`, count: counts.pastEvents, href: '/dashboard/organizer/events' })
  if (counts.oldGallery > 0) lines.push({ label: `${counts.oldGallery} old gallery photo${counts.oldGallery > 1 ? 's' : ''}`, count: counts.oldGallery, href: '/dashboard/organizer/gallery' })

  return (
    <div className="rounded-2xl border border-amber-300/60 dark:border-amber-800/50 bg-surface dark:bg-[#0d1729] shadow-2xl overflow-hidden" style={{ animation: 'notif-slide 0.25s ease both' }}>
      <div className="p-3.5 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100 dark:bg-amber-900/30">
          <span className="material-symbols-outlined icon-fill text-amber-600 dark:text-amber-400" style={{ fontSize: 22 }}>auto_delete</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-amber-600 dark:text-amber-400">Cleanup reminder</p>
          <div className="space-y-0.5">
            {lines.map((l) => (
              <Link key={l.href} href={l.href} onClick={onDismiss}
                className="flex items-center gap-1.5 text-[12px] font-medium text-on-surface dark:text-blue-50 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 12 }}>chevron_right</span>
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-1">
            Consider archiving old records.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-outline hover:text-on-surface transition-colors mt-0.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      </div>
    </div>
  )
}

function NotifCard({ item, onDismiss }: { item: NotifItem; onDismiss: () => void }) {
  const cfg = CFG[item.type]

  useEffect(() => {
    const t = setTimeout(onDismiss, 12_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface dark:bg-[#0d1729] shadow-2xl overflow-hidden" style={{ animation: 'notif-slide 0.25s ease both' }}>
      <div className="p-3.5 flex items-start gap-3">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
            <span className={`material-symbols-outlined icon-fill ${cfg.color}`} style={{ fontSize: 22 }}>
              {cfg.icon}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${cfg.color}`}>{cfg.label}</p>
          <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 leading-snug line-clamp-2">{item.title}</p>
          <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5 line-clamp-1">{item.description}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-outline hover:text-on-surface transition-colors mt-0.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      </div>
      <Link
        href={item.href}
        onClick={onDismiss}
        className="flex items-center justify-between px-3.5 py-2 bg-surface-container dark:bg-[#111f36] border-t border-outline-variant/30 hover:bg-surface-container-high dark:hover:bg-[#1a2d4f] transition-colors"
      >
        <span className="text-[12px] font-semibold text-primary">View details</span>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>arrow_forward</span>
      </Link>
    </div>
  )
}
