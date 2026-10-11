'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { deleteNotification, markNotificationItemRead } from '@/app/actions/notifications'
import { NOTIFICATIONS_ALL_READ_EVENT, NOTIFICATIONS_READ_EVENT } from '@/components/dashboard/NotificationActions'

export type NotificationItem = {
  id: string
  kind: 'todo' | 'payment' | 'message' | 'announcement'
  /** To-dos need someone to act; notifications are just for information. */
  group: 'todo' | 'notification'
  icon: string
  title: string
  summary: string
  date: string | null
  unread: boolean
  href: string | null
  openLabel?: string
  count?: number
  details: { label: string; value: string }[]
  imageUrl?: string | null
}

type Filter = 'all' | NotificationItem['group']

const FILTERS: Filter[] = ['all', 'todo', 'notification']

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  todo: 'To-dos',
  notification: 'Notifications',
}

const withId = (id: string) => {
  const formData = new FormData()
  formData.set('id', id)
  return formData
}

export default function NotificationsList({ items }: { items: NotificationItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<NotificationItem | null>(null)
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set())

  const keyOf = (item: NotificationItem) => `${item.kind}-${item.id}`

  useEffect(() => setReadKeys(new Set()), [items])
  useEffect(() => {
    const markAll = () => setReadKeys(new Set(items.map(keyOf)))
    window.addEventListener(NOTIFICATIONS_ALL_READ_EVENT, markAll)
    return () => window.removeEventListener(NOTIFICATIONS_ALL_READ_EVENT, markAll)
  }, [items])
  const rows = useMemo(
    () => items.map((item) => (readKeys.has(keyOf(item)) ? { ...item, unread: false } : item)),
    [items, readKeys],
  )
  const visible = useMemo(() => rows.filter((item) => filter === 'all' || item.group === filter), [rows, filter])

  const run = (action: () => Promise<unknown>) =>
    startTransition(async () => {
      await action()
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
      router.refresh()
    })

  const markRead = (item: NotificationItem) => {
    if (!item.unread) return
    setReadKeys((current) => new Set(current).add(keyOf(item)))
    run(() => markNotificationItemRead({ kind: item.kind, id: item.id }))
  }

  const open = (item: NotificationItem) => {
    setSelected(item)
    markRead(item)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter notifications">
        {FILTERS.map((value) => {
          const count = value === 'all' ? rows.length : rows.filter((i) => i.group === value).length
          const active = filter === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                active ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:border-primary/40'
              }`}
            >
              {FILTER_LABEL[value]}
              <span className={`text-[10px] ${active ? 'text-on-primary/80' : 'text-outline'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant bg-surface px-4 py-8 text-center text-sm text-on-surface-variant">
          Nothing here.
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant overflow-hidden rounded-2xl border border-outline-variant bg-surface">
          {visible.map((item) => (
            <li
              key={keyOf(item)}
              className={`flex items-center gap-3 border-l-4 px-4 py-3 transition-colors ${
                item.unread ? 'border-l-secondary-container bg-secondary-container/10' : 'border-l-transparent'
              }`}
            >
              <span className={`material-symbols-outlined shrink-0 text-[20px] ${item.unread ? 'text-secondary' : 'text-outline'}`}>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${item.unread ? 'font-semibold text-on-surface' : 'font-normal text-on-surface-variant'}`}>{item.title}</span>
                <span className="block truncate text-xs text-on-surface-variant">{item.summary}</span>
              </span>
              {item.date && <span className="hidden shrink-0 text-[11px] text-outline sm:block">{item.date}</span>}
              <button
                type="button"
                onClick={() => markRead(item)}
                disabled={!item.unread}
                title={item.unread ? 'Mark as read' : 'Read'}
                aria-label={item.unread ? `Mark as read: ${item.title}` : `${item.title} is read`}
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                  item.unread ? 'text-primary hover:bg-primary/10' : 'text-outline/40'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
              </button>
              <button
                type="button"
                onClick={() => open(item)}
                title="View details"
                aria-label={`View details: ${item.title}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-outline transition hover:bg-primary/10 hover:text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FullScreenModal open={Boolean(selected)} title={selected?.title ?? ''} onClose={() => setSelected(null)} size="compact">
        {selected && (
          <div className="space-y-4">
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface">{selected.summary}</p>
            {selected.details.length > 0 && (
              <dl className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                {selected.details.map((detail) => (
                  <div key={detail.label} className="flex justify-between gap-4 px-3 py-2 text-sm">
                    <dt className="text-on-surface-variant">{detail.label}</dt>
                    <dd className="text-right font-medium text-on-surface">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex gap-2">
              {selected.href && (
                <Link href={selected.href} className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary hover:opacity-90">
                  {selected.openLabel ?? 'Open'}
                </Link>
              )}
              {selected.kind === 'message' && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const id = selected.id
                    setSelected(null)
                    run(() => deleteNotification(withId(id)))
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-error/40 px-4 text-sm font-semibold text-error hover:bg-error-container/40 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </FullScreenModal>
    </div>
  )
}
