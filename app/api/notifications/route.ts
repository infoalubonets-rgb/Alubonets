import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { getRecentItems, getOldAnnouncementsCount, getPastEventsCount, getOldGalleryCount } from '@/lib/data/queries'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['ADMIN', 'SECRETARY', 'EXECUTIVE', 'ORGANIZER']

const EMPTY = { items: [], announcementCount: 0, pastEventsCount: 0, oldGalleryCount: 0 }

export async function GET() {
  try {
    const profile = await getSessionProfile()
    if (!profile) return NextResponse.json({ items: [] }, { status: 401 })

    const isManager = MANAGER_ROLES.includes(profile.role)
    const windowHours = isManager ? 48 : 6

    const [{ events, projects, photos }, announcementCount, pastEventsCount, oldGalleryCount] = await Promise.all([
      getRecentItems(windowHours),
      isManager ? getOldAnnouncementsCount() : Promise.resolve(0),
      isManager ? getPastEventsCount() : Promise.resolve(0),
      isManager ? getOldGalleryCount() : Promise.resolve(0),
    ])

    const items = [
      ...events.map((e) => ({
        id: `event-${e.id}`,
        type: 'event' as const,
        title: e.title,
        description: e.location ?? 'New upcoming event',
        imageUrl: e.imageUrl ?? null,
        href: `/events/${e.id}`,
        createdAt: e.createdAt.toISOString(),
      })),
      ...projects.map((p) => ({
        id: `project-${p.id}`,
        type: 'project' as const,
        title: p.title,
        description: p.status.charAt(0) + p.status.slice(1).toLowerCase(),
        imageUrl: p.imageUrl ?? null,
        href: `/projects/${p.id}`,
        createdAt: p.createdAt.toISOString(),
      })),
      ...photos.map((p) => ({
        id: `gallery-${p.id}`,
        type: 'gallery' as const,
        title: p.caption ?? 'New photo added',
        description: p.category ?? 'Gallery',
        imageUrl: p.url,
        href: '/gallery',
        createdAt: p.uploadedAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return NextResponse.json({ items, announcementCount, pastEventsCount, oldGalleryCount })
  } catch (err) {
    console.error('[/api/notifications]', err)
    return NextResponse.json(EMPTY)
  }
}
