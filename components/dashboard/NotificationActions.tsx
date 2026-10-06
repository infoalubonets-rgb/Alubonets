'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clearReadNotifications, markNotificationsRead } from '@/app/actions/notifications'

/** Fired after notifications change so the header bell recounts at once. */
export const NOTIFICATIONS_READ_EVENT = 'notifications-read'

function useNotificationAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = (action: () => Promise<unknown>) =>
    startTransition(async () => {
      await action()
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
      router.refresh()
    })
  return { pending, run }
}

/** Fired the moment "Mark all as read" is pressed so the list greys out before the server replies. */
export const NOTIFICATIONS_ALL_READ_EVENT = 'notifications-all-read'

const ICON_BUTTON =
  'relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface transition disabled:opacity-40'

/** Clears the bell: every notification, role to-do and recent payment counts as seen. */
export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const { pending, run } = useNotificationAction()
  const label = unreadCount > 0 ? `Mark all as read (${unreadCount})` : 'Everything is read'
  return (
    <button
      type="button"
      disabled={pending || unreadCount === 0}
      onClick={() => {
        window.dispatchEvent(new Event(NOTIFICATIONS_ALL_READ_EVENT))
        run(() => markNotificationsRead())
      }}
      title={label}
      aria-label={label}
      className={`${ICON_BUTTON} text-primary hover:border-primary/40 hover:bg-primary/5`}
    >
      <span className={`material-symbols-outlined text-[20px] ${pending ? 'animate-pulse' : ''}`}>done_all</span>
    </button>
  )
}

export function ClearReadButton({ readCount }: { readCount: number }) {
  const { pending, run } = useNotificationAction()
  const label = `Delete read messages (${readCount})`
  return (
    <button
      type="button"
      disabled={pending || readCount === 0}
      onClick={() => run(() => clearReadNotifications())}
      title={label}
      aria-label={label}
      className={`${ICON_BUTTON} text-error hover:border-error/40 hover:bg-error-container/40`}
    >
      <span className={`material-symbols-outlined text-[20px] ${pending ? 'animate-pulse' : ''}`}>delete_sweep</span>
    </button>
  )
}
