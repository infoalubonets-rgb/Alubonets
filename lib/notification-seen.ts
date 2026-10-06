import { prisma } from '@/lib/prisma'

/**
 * What a member had already seen when they last pressed "Mark all as read". Role to-dos and
 * recent payments are live counts that can't be "read", so the bell only counts what is new
 * since that moment.
 */
export type NotificationsSeen = {
  /** Role alert key → its count when last marked read. */
  alerts: Record<string, number>
  /** Payments up to this time no longer count on the bell. */
  paymentsSeenAt: string | null
  /** Newer payments marked read one at a time. */
  paymentIds?: string[]
}

const settingKey = (userId: string) => `notifications_seen:${userId}`

export async function getNotificationsSeen(userId: string): Promise<NotificationsSeen> {
  const row = await prisma.appSetting.findUnique({ where: { key: settingKey(userId) } })
  try {
    const parsed = row ? (JSON.parse(row.value) as Partial<NotificationsSeen>) : {}
    return { alerts: parsed.alerts ?? {}, paymentsSeenAt: parsed.paymentsSeenAt ?? null, paymentIds: parsed.paymentIds ?? [] }
  } catch {
    return { alerts: {}, paymentsSeenAt: null, paymentIds: [] }
  }
}

export async function saveNotificationsSeen(userId: string, seen: NotificationsSeen) {
  const value = JSON.stringify(seen)
  await prisma.appSetting.upsert({
    where: { key: settingKey(userId) },
    create: { key: settingKey(userId), value, updatedBy: userId },
    update: { value, updatedBy: userId },
  })
}

/** Role to-dos the bell should still count: only items added since they were last marked read. */
export function unseenAlertCount(alerts: { key: string; count: number }[], seen: NotificationsSeen) {
  return alerts.reduce((sum, alert) => sum + Math.max(0, alert.count - (seen.alerts[alert.key] ?? 0)), 0)
}

/** Recent payments count from whichever is later: 24 hours ago, or when they were last marked read. */
export function paymentsCountFrom(seen: NotificationsSeen, now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const seenAt = seen.paymentsSeenAt ? new Date(seen.paymentsSeenAt) : null
  return seenAt && seenAt > dayAgo ? seenAt : dayAgo
}
