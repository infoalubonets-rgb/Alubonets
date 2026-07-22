import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { PaymentMethod, ProjectStatus, WelfareStatus } from '@prisma/client'

// ─── Cache tags ────────────────────────────────────────────────────────────────
export const TAGS = {
  members:       'members',
  contributions: 'contributions',
  welfare:       'welfare',
  events:        'events',
  gallery:       'gallery',
  announcements: 'announcements',
  documents:     'documents',
  projects:      'projects',
  meetings:      'meetings',
} as const

// ─── Cached read queries ────────────────────────────────────────────────────────

export const getAdminDashboardData = unstable_cache(
  async () => {
    const [
      totalMembers, activeMembers, pendingMembers, pendingList,
      contributionAgg, openWelfare, recentAudit, galleryQueue, allUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.user.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.contribution.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.welfareRequest.count({ where: { status: 'PENDING' } }),
      prisma.auditLog.findMany({
        take: 10, orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      prisma.galleryPhoto.findMany({ where: { isPublic: false }, orderBy: { uploadedAt: 'desc' }, take: 10 }),
      prisma.user.findMany({ where: { status: { in: ['ACTIVE', 'PENDING'] } }, orderBy: { fullName: 'asc' } }),
    ])
    return {
      totalMembers, activeMembers, pendingMembers, pendingList,
      totalContributions: contributionAgg._sum.amount ?? 0,
      contributionCount: contributionAgg._count,
      openWelfare, recentAudit, galleryQueue, allUsers,
    }
  },
  ['admin-dashboard'],
  { tags: [TAGS.members, TAGS.contributions, TAGS.welfare, TAGS.gallery], revalidate: 60 },
)

export const getExecutiveDashboardData = unstable_cache(
  async () => {
    const [members, contributions, projects, events, announcements] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.contribution.aggregate({ _sum: { amount: true } }),
      prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 }),
      prisma.event.count({ where: { startsAt: { gte: new Date() } } }),
      prisma.announcement.findMany({
        where: { broadcast: true }, orderBy: { publishedAt: 'desc' }, take: 5,
      }),
    ])
    return {
      members,
      totalContributions: contributions._sum.amount ?? 0,
      projects,
      upcomingEvents: events,
      announcements,
    }
  },
  ['executive-dashboard'],
  { tags: [TAGS.members, TAGS.contributions, TAGS.projects, TAGS.events, TAGS.announcements], revalidate: 60 },
)

export const getTreasurerDashboardData = unstable_cache(
  async () => {
    const [agg, recent, byCategory, pendingWelfare, members] = await Promise.all([
      prisma.contribution.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.contribution.findMany({
        take: 20, orderBy: { paidAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      prisma.contribution.groupBy({ by: ['category'], _sum: { amount: true }, _count: true }),
      prisma.welfareRequest.findMany({
        where: { status: 'PENDING' },
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      }),
    ])
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthAgg = await prisma.contribution.aggregate({
      where: { paidAt: { gte: monthStart } },
      _sum: { amount: true },
    })
    return {
      total: agg._sum.amount ?? 0,
      count: agg._count,
      monthTotal: monthAgg._sum.amount ?? 0,
      recent, byCategory, pendingWelfare, members,
    }
  },
  ['treasurer-dashboard'],
  { tags: [TAGS.contributions, TAGS.welfare, TAGS.members], revalidate: 60 },
)

export const getSecretaryDashboardData = unstable_cache(
  async () => {
    const [documents, meetings, announcements, events] = await Promise.all([
      prisma.document.findMany({
        orderBy: { uploadedAt: 'desc' },
        include: { uploader: { select: { fullName: true } } },
        take: 20,
      }),
      prisma.meeting.findMany({ orderBy: { heldAt: 'desc' }, take: 10 }),
      prisma.announcement.findMany({
        where: { broadcast: true },
        orderBy: { publishedAt: 'desc' },
        include: { author: { select: { fullName: true } } },
        take: 10,
      }),
      prisma.event.findMany({ orderBy: { startsAt: 'asc' }, take: 10 }),
    ])
    const attendanceAvg =
      meetings.length === 0
        ? 0
        : Math.round(meetings.reduce((s, m) => s + m.attendance, 0) / meetings.length)
    return { documents, meetings, announcements, events, attendanceAvg }
  },
  ['secretary-dashboard'],
  { tags: [TAGS.documents, TAGS.meetings, TAGS.announcements, TAGS.events], revalidate: 60 },
)

export const getOrganizerDashboardData = unstable_cache(
  async () => {
    const [events, galleryCount, projectCount] = await Promise.all([
      prisma.event.findMany({
        orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, startsAt: true, location: true, description: true },
      }),
      prisma.galleryPhoto.count(),
      prisma.project.count(),
    ])
    const now = new Date()
    const upcoming = events
      .filter((e) => e.startsAt >= now)
      .map((e) => ({ ...e, startsAt: e.startsAt.toISOString() }))
    return {
      events: events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() })),
      upcoming,
      galleryCount,
      projectCount,
    }
  },
  ['organizer-dashboard'],
  { tags: [TAGS.events, TAGS.gallery, TAGS.projects], revalidate: 60 },
)

// Returns events split into upcoming/past with ISO string dates — for client components
export const getOrganizerEvents = unstable_cache(
  async () => {
    const events = await prisma.event.findMany({
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, startsAt: true, location: true,
        description: true, imageUrl: true, isPublic: true,
      },
    })
    const now = new Date()
    const rows = events.map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location ?? null,
      description: e.description ?? null,
      imageUrl: e.imageUrl ?? null,
      isPublic: e.isPublic ?? true,
      startsAt: e.startsAt.toISOString(),
    }))
    return {
      upcoming: rows.filter((e) => new Date(e.startsAt) >= now),
      past: rows.filter((e) => new Date(e.startsAt) < now).reverse(),
    }
  },
  ['organizer-events'],
  { tags: [TAGS.events], revalidate: 60 },
)

// Returns gallery photos with ISO string dates — for client components
export const getOrganizerGalleryPhotos = unstable_cache(
  async () => {
    const photos = await prisma.galleryPhoto.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 100,
      select: {
        id: true, url: true, caption: true, category: true,
        isPublic: true, uploadedAt: true,
      },
    })
    return photos.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption ?? null,
      category: p.category ?? null,
      isPublic: p.isPublic,
      uploadedAt: p.uploadedAt.toISOString(),
    }))
  },
  ['organizer-gallery'],
  { tags: [TAGS.gallery], revalidate: 60 },
)

export const getMemberDashboardData = unstable_cache(
  async (userId: string) => {
    const [contributions, announcements, events, documents, welfare] = await Promise.all([
      prisma.contribution.findMany({ where: { userId }, orderBy: { paidAt: 'desc' } }),
      prisma.announcement.findMany({
        where: { broadcast: true }, orderBy: { publishedAt: 'desc' }, take: 5,
      }),
      prisma.event.findMany({
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 5,
        select: { id: true, title: true, startsAt: true },
      }),
      prisma.document.findMany({
        orderBy: { uploadedAt: 'desc' }, take: 5,
        select: { id: true, title: true, fileUrl: true },
      }),
      prisma.welfareRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ])
    const total = contributions.reduce((s, c) => s + c.amount, 0)
    // Convert dates to ISO strings for consistent serialization
    return {
      contributions,
      total,
      announcements: announcements.map((a) => ({
        ...a,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      })),
      events: events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() })),
      documents,
      welfare,
      welfareCount: welfare.length,
    }
  },
  ['member-dashboard'],
  { tags: [TAGS.contributions, TAGS.welfare, TAGS.announcements, TAGS.events, TAGS.documents], revalidate: 60 },
)

export const getPublicProject = unstable_cache(
  async (id: string) => prisma.project.findUnique({ where: { id } }),
  ['public-project'],
  { tags: [TAGS.projects], revalidate: 300 },
)

export const getPublicGallery = unstable_cache(
  async () =>
    prisma.galleryPhoto.findMany({ where: { isPublic: true }, orderBy: { uploadedAt: 'desc' } }),
  ['public-gallery'],
  { tags: [TAGS.gallery], revalidate: 300 },
)

export const getPublicProjects = unstable_cache(
  async () => prisma.project.findMany({ orderBy: { updatedAt: 'desc' } }),
  ['public-projects'],
  { tags: [TAGS.projects], revalidate: 300 },
)

// Returns public events with ISO string dates for the public events page
export const getPublicEvents = unstable_cache(
  async () => {
    const events = await prisma.event.findMany({
      where: { isPublic: true },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, description: true, location: true,
        startsAt: true, imageUrl: true,
      },
    })
    const now = new Date()
    const rows = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? null,
      location: e.location ?? null,
      imageUrl: e.imageUrl ?? null,
      startsAt: e.startsAt.toISOString(),
    }))
    return {
      upcoming: rows.filter((e) => new Date(e.startsAt) >= now),
      past: rows.filter((e) => new Date(e.startsAt) < now).reverse().slice(0, 6),
    }
  },
  ['public-events'],
  { tags: [TAGS.events], revalidate: 300 },
)

export const getContributionChartSeries = unstable_cache(
  async () => {
    const rows = await prisma.contribution.findMany({
      select: { amount: true, paidAt: true, category: true },
      orderBy: { paidAt: 'asc' },
    })
    const byMonth = new Map<string, number>()
    for (const row of rows) {
      const key = `${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount)
    }
    return { labels: [...byMonth.keys()], values: [...byMonth.values()] }
  },
  ['contribution-chart'],
  { tags: [TAGS.contributions], revalidate: 120 },
)

export const getContributionAnalytics = unstable_cache(
  async () => {
    const [byMethod, byUser] = await Promise.all([
      prisma.contribution.groupBy({ by: ['paymentMethod'], _sum: { amount: true }, _count: true }),
      prisma.contribution.groupBy({
        by: ['userId'], _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } },
      }),
    ])
    const top = byUser.slice(0, 8)
    const users = await prisma.user.findMany({
      where: { id: { in: top.map((u) => u.userId) } },
      select: { id: true, fullName: true },
    })
    const nameById = new Map(users.map((u) => [u.id, u.fullName]))
    return {
      contributorCount: byUser.length,
      byMethod: byMethod.map((m) => ({
        method: m.paymentMethod,
        total: m._sum.amount ?? 0,
        count: m._count,
      })),
      topContributors: top.map((u) => ({
        name: nameById.get(u.userId) ?? 'Unknown member',
        total: u._sum.amount ?? 0,
      })),
    }
  },
  ['contribution-analytics'],
  { tags: [TAGS.contributions, TAGS.members], revalidate: 120 },
)

export const getAnnouncementsForUser = unstable_cache(
  async (userId: string) =>
    prisma.announcement.findMany({
      where: { OR: [{ broadcast: true }, { receipts: { some: { userId } } }] },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        broadcast: true,
        emailSentAt: true,
        author: { select: { fullName: true } },
        receipts: { where: { userId }, select: { readAt: true } },
      },
    }),
  ['announcements-for-user'],
  { tags: [TAGS.announcements], revalidate: 60 },
)

export const getUnreadAnnouncementCount = unstable_cache(
  async (userId: string) =>
    prisma.announcementReceipt.count({ where: { userId, readAt: null } }),
  ['unread-announcement-count'],
  { tags: [TAGS.announcements], revalidate: 30 },
)

export const getRecentItems = unstable_cache(
  async (windowHours = 48) => {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000)
    const [events, projects, photos] = await Promise.all([
      prisma.event.findMany({
        where: { createdAt: { gte: since }, startsAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, location: true, imageUrl: true, createdAt: true },
      }),
      prisma.project.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, imageUrl: true, createdAt: true },
      }),
      prisma.galleryPhoto.findMany({
        where: { uploadedAt: { gte: since }, isPublic: true },
        orderBy: { uploadedAt: 'desc' },
        take: 5,
        select: { id: true, url: true, caption: true, category: true, uploadedAt: true },
      }),
    ])
    return { events, projects, photos }
  },
  ['recent-items'],
  { tags: [TAGS.events, TAGS.projects, TAGS.gallery], revalidate: 120 },
)

export const getOldAnnouncementsCount = unstable_cache(
  async () => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
    return prisma.announcement.count({ where: { publishedAt: { lt: cutoff } } })
  },
  ['old-announcements-count'],
  { tags: [TAGS.announcements], revalidate: 300 },
)

export const getActiveMembers = unstable_cache(
  async () => {
    return prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    })
  },
  ['active-members-list'],
  { tags: [TAGS.members], revalidate: 300 },
)

export const getPastEventsCount = unstable_cache(
  async () => {
    return prisma.event.count({ where: { startsAt: { lt: new Date() } } })
  },
  ['past-events-count'],
  { tags: [TAGS.events], revalidate: 3600 },
)

export const getOldGalleryCount = unstable_cache(
  async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    return prisma.galleryPhoto.count({ where: { uploadedAt: { lt: cutoff } } })
  },
  ['old-gallery-count'],
  { tags: [TAGS.gallery], revalidate: 3600 },
)

export const getOrganizerProjects = unstable_cache(
  async () => {
    const projects = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' } })
    return projects.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status as 'UPCOMING' | 'ONGOING' | 'COMPLETED',
      imageUrl: p.imageUrl ?? null,
      progress: p.progress,
      updatedAt: p.updatedAt.toISOString(),
    }))
  },
  ['organizer-projects'],
  { tags: [TAGS.projects], revalidate: 60 },
)

// ─── Write functions (not cached) ──────────────────────────────────────────────

export type CreateContributionInput = {
  userId: string
  amount: number
  description?: string
  category?: string
  paymentMethod?: PaymentMethod
  receivedBy?: string
  mpesaRef?: string
  statementRef?: string
  paidAt?: Date
}

export async function createContribution(data: CreateContributionInput) {
  return prisma.contribution.create({ data })
}

export async function updateWelfareStatus(id: string, status: WelfareStatus, reviewNote?: string) {
  return prisma.welfareRequest.update({
    where: { id }, data: { status, reviewNote }, include: { user: true },
  })
}

export async function createWelfareRequest(userId: string, description: string, amount?: number) {
  return prisma.welfareRequest.create({ data: { userId, description, amount } })
}

export async function createAnnouncement(authorId: string, title: string, content: string) {
  return prisma.announcement.create({ data: { authorId, title, content } })
}

export async function sendAnnouncement(input: {
  authorId: string
  title: string
  content: string
  broadcast: boolean
  memberIds?: string[]
  includeSelf?: boolean  // when true, author is included in broadcast receipts
}) {
  const recipientIds = input.broadcast
    ? (
        await prisma.user.findMany({
          where: {
            status: 'ACTIVE',
            ...(input.includeSelf ? {} : { id: { not: input.authorId } }),
          },
          select: { id: true },
        })
      ).map((u) => u.id)
    : (input.memberIds ?? []) // targeted: send to exactly who's specified

  return prisma.announcement.create({
    data: {
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      broadcast: input.broadcast,
      receipts: { create: recipientIds.map((userId) => ({ userId })) },
    },
  })
}

export async function markAnnouncementsRead(userId: string) {
  await prisma.announcementReceipt.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
}

export async function deleteAnnouncement(id: string) {
  return prisma.announcement.delete({ where: { id } })
}

export async function createEvent(data: {
  title: string
  description?: string
  location?: string
  startsAt: Date
  endsAt?: Date
  imageUrl?: string
  isPublic?: boolean
}) {
  return prisma.event.create({ data })
}

export async function updateEvent(id: string, data: {
  title?: string
  description?: string | null
  location?: string | null
  startsAt?: Date
  imageUrl?: string | null
  isPublic?: boolean
}) {
  return prisma.event.update({ where: { id }, data })
}

export async function updateGalleryPhoto(id: string, data: {
  caption?: string | null
  category?: string | null
}) {
  return prisma.galleryPhoto.update({ where: { id }, data })
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } })
}

export async function deleteEvent(id: string) {
  return prisma.event.delete({ where: { id } })
}

export async function deleteEvents(ids: string[]) {
  return prisma.event.deleteMany({ where: { id: { in: ids } } })
}

export async function deleteGalleryPhoto(id: string) {
  return prisma.galleryPhoto.delete({ where: { id } })
}

export async function deleteGalleryPhotos(ids: string[]) {
  return prisma.galleryPhoto.deleteMany({ where: { id: { in: ids } } })
}

export async function createMeeting(data: {
  title: string
  agenda?: string
  minutes?: string
  opening?: string
  location?: string
  attendees?: string
  resolutions?: string
  nextMeetingAt?: Date
  heldAt: Date
  attendance: number
  recordedBy: string
  status?: 'DRAFT' | 'FINAL'
}) {
  return prisma.meeting.create({ data })
}

export async function updateMeeting(
  id: string,
  data: {
    title?: string
    agenda?: string | null
    minutes?: string | null
    opening?: string | null
    location?: string | null
    attendees?: string | null
    resolutions?: string | null
    nextMeetingAt?: Date | null
    heldAt?: Date
    attendance?: number
    status?: 'DRAFT' | 'FINAL'
    publishedDocumentId?: string | null
  }
) {
  return prisma.meeting.update({ where: { id }, data })
}

export async function createDocument(data: {
  title: string
  fileUrl: string
  category?: string
  uploadedBy: string
}) {
  return prisma.document.create({ data })
}

export async function createGalleryPhoto(data: {
  url: string
  caption?: string
  category?: string
  uploadedBy?: string
  isPublic?: boolean
}) {
  return prisma.galleryPhoto.create({
    data: { ...data, approvedAt: data.isPublic ? new Date() : null },
  })
}

export async function approveGalleryPhoto(id: string, approve: boolean) {
  return prisma.galleryPhoto.update({
    where: { id },
    data: approve ? { isPublic: true, approvedAt: new Date() } : { isPublic: false, approvedAt: null },
  })
}

export async function upsertProject(data: {
  id?: string
  title: string
  description: string
  status: ProjectStatus
  imageUrl?: string
  progress?: number
  startDate?: Date
  endDate?: Date
}) {
  if (data.id) {
    return prisma.project.update({
      where: { id: data.id },
      data: {
        title: data.title, description: data.description, status: data.status,
        imageUrl: data.imageUrl, progress: data.progress ?? 0,
        startDate: data.startDate, endDate: data.endDate,
      },
    })
  }
  return prisma.project.create({
    data: {
      title: data.title, description: data.description, status: data.status,
      imageUrl: data.imageUrl, progress: data.progress ?? 0,
      startDate: data.startDate, endDate: data.endDate,
    },
  })
}
