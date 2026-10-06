import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { getRecentItems, getOldAnnouncementsCount, getPastEventsCount, getOldGalleryCount } from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['ADMIN', 'SECRETARY', 'EXECUTIVE', 'ORGANIZER']
const PAYMENT_ROLES = ['TREASURER', 'ADMIN']

const EMPTY = { items: [], announcementCount: 0, pastEventsCount: 0, oldGalleryCount: 0, unreadCount: 0 }

type StkMeta = { amount?: number; receipt?: string; phone?: string; checkoutRequestId?: string }

export async function GET() {
  try {
    const profile = await getSessionProfile()
    if (!profile) return NextResponse.json({ items: [] }, { status: 401 })

    const isManager = MANAGER_ROLES.includes(profile.role)
    const isPaymentRole = PAYMENT_ROLES.includes(profile.role)
    const windowHours = isManager ? 48 : 6

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [{ events, projects, photos }, announcementCount, pastEventsCount, oldGalleryCount, recentPayments, persisted] =
      await Promise.all([
        getRecentItems(windowHours),
        isManager ? getOldAnnouncementsCount() : Promise.resolve(0),
        isManager ? getPastEventsCount() : Promise.resolve(0),
        isManager ? getOldGalleryCount() : Promise.resolve(0),
        isPaymentRole
          ? prisma.auditLog.findMany({
              where: { action: 'MPESA_STK_SUCCESS', createdAt: { gte: since24h } },
              include: { user: { select: { fullName: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            })
          : Promise.resolve([]),
        prisma.userNotification.findMany({
          where: { userId: profile.id, readAt: null },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
      ])

    const items = [
      ...persisted.map((n) => ({
        id: `notice-${n.id}`,
        type: n.type,
        title: n.title,
        description: n.body ?? '',
        imageUrl: null as string | null,
        href: n.href || '/dashboard/member',
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
      ...events.map((e) => ({
        id: `event-${e.id}`,
        type: 'event' as const,
        title: e.title,
        description: e.location ?? 'New upcoming event',
        imageUrl: e.imageUrl ?? null,
        href: `/events/${e.id}`,
        createdAt: new Date(e.createdAt).toISOString(),
        readAt: null as string | null,
      })),
      ...projects.map((p) => ({
        id: `project-${p.id}`,
        type: 'project' as const,
        title: p.title,
        description: p.status.charAt(0) + p.status.slice(1).toLowerCase(),
        imageUrl: p.imageUrl ?? null,
        href: `/projects/${p.id}`,
        createdAt: new Date(p.createdAt).toISOString(),
        readAt: null as string | null,
      })),
      ...photos.map((p) => ({
        id: `gallery-${p.id}`,
        type: 'gallery' as const,
        title: p.caption ?? 'New photo added',
        description: p.category ?? 'Gallery',
        imageUrl: p.url,
        href: '/gallery',
        createdAt: new Date(p.uploadedAt).toISOString(),
        readAt: null as string | null,
      })),
      ...recentPayments.map((a) => {
        const meta = (a.meta ?? {}) as StkMeta
        const amount = meta.amount ?? 0
        return {
          id: `payment-${a.id}`,
          type: 'payment' as const,
          title: `KES ${Math.round(amount).toLocaleString()} from ${a.user?.fullName ?? 'a member'}`,
          description: meta.receipt || meta.phone || 'M-Pesa payment received',
          imageUrl: null,
          href: '/notifications',
          createdAt: new Date(a.createdAt).toISOString(),
          readAt: null as string | null,
        }
      }),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const unreadCount = persisted.filter((n) => !n.readAt).length

    return NextResponse.json({ items, announcementCount, pastEventsCount, oldGalleryCount, unreadCount })
  } catch (err) {
    console.error('[/api/notifications]', err)
    return NextResponse.json(EMPTY)
  }
}
