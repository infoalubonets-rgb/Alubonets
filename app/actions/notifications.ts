'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { TAGS } from '@/lib/data/queries'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSessionProfile } from '@/lib/auth/session'
import { getRoleAlerts } from '@/lib/role-alerts'
import { getNotificationsSeen, saveNotificationsSeen } from '@/lib/notification-seen'
import type { Role } from '@/lib/auth/types'

/** Marks one notification read, or — with no id — everything, clearing the bell. */
export async function markNotificationsRead(formData?: FormData) {
  const actor = await requireSessionProfile()
  const id = z.string().min(1).optional().parse(formData?.get('id') || undefined)
  await prisma.userNotification.updateMany({
    where: {
      userId: actor.id,
      readAt: null,
      ...(id ? { id } : {}),
    },
    data: { readAt: new Date() },
  })
  if (!id) {
    await prisma.announcementReceipt.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: new Date() } })
    revalidateTag(TAGS.announcements)
    // Role to-dos and recent payments can't be "read" one by one; remember what was showing
    // so the bell only counts what arrives after this.
    const alerts = await getRoleAlerts({ id: actor.id, role: actor.role as Role, isSuperAdmin: actor.isSuperAdmin, dashboardAccess: actor.dashboardAccess as Role[] })
    await saveNotificationsSeen(actor.id, {
      alerts: Object.fromEntries(alerts.map((alert) => [alert.key, alert.count])),
      paymentsSeenAt: new Date().toISOString(),
      paymentIds: [],
    })
  }
  revalidatePath('/notifications')
  return { ok: true }
}

const itemSchema = z.object({ kind: z.enum(['todo', 'payment', 'message', 'announcement']), id: z.string().min(1).max(100) })

/** Marks a single row on the Notifications page read — a message, announcement, role to-do or payment. */
export async function markNotificationItemRead(input: z.infer<typeof itemSchema>) {
  const actor = await requireSessionProfile()
  const { kind, id } = itemSchema.parse(input)
  if (kind === 'announcement') {
    await prisma.announcementReceipt.updateMany({ where: { announcementId: id, userId: actor.id, readAt: null }, data: { readAt: new Date() } })
    revalidateTag(TAGS.announcements)
  } else if (kind === 'message') {
    await prisma.userNotification.updateMany({ where: { id, userId: actor.id, readAt: null }, data: { readAt: new Date() } })
  } else {
    const seen = await getNotificationsSeen(actor.id)
    if (kind === 'todo') {
      const alerts = await getRoleAlerts({ id: actor.id, role: actor.role as Role, isSuperAdmin: actor.isSuperAdmin, dashboardAccess: actor.dashboardAccess as Role[] })
      const alert = alerts.find((item) => item.key === id)
      if (alert) seen.alerts = { ...seen.alerts, [alert.key]: alert.count }
    } else {
      // Only the last week of payments is ever listed, so the id list stays small.
      seen.paymentIds = [id, ...(seen.paymentIds ?? []).filter((value) => value !== id)].slice(0, 200)
    }
    await saveNotificationsSeen(actor.id, seen)
  }
  revalidatePath('/notifications')
  return { ok: true }
}

/** Deletes one of the signed-in member's own notifications. */
export async function deleteNotification(formData: FormData) {
  const actor = await requireSessionProfile()
  const id = z.string().min(1).parse(formData.get('id'))
  // Scoped to the owner, so a member can never delete someone else's notification.
  await prisma.userNotification.deleteMany({ where: { id, userId: actor.id } })
  revalidatePath('/notifications')
}

/** Deletes every notification the signed-in member has already read. */
export async function clearReadNotifications() {
  const actor = await requireSessionProfile()
  await prisma.userNotification.deleteMany({ where: { userId: actor.id, readAt: { not: null } } })
  revalidatePath('/notifications')
}
