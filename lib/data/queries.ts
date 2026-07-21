import { prisma } from '@/lib/prisma'
import type { PaymentMethod, ProjectStatus, WelfareStatus } from '@prisma/client'

export async function getAdminDashboardData() {
  const [
    totalMembers,
    activeMembers,
    pendingMembers,
    pendingList,
    contributionAgg,
    openWelfare,
    recentAudit,
    galleryQueue,
    allUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'PENDING' } }),
    prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.contribution.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.welfareRequest.count({ where: { status: 'PENDING' } }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.galleryPhoto.findMany({
      where: { isPublic: false },
      orderBy: { uploadedAt: 'desc' },
      take: 10,
    }),
    prisma.user.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING'] } },
      orderBy: { fullName: 'asc' },
    }),
  ])

  return {
    totalMembers,
    activeMembers,
    pendingMembers,
    pendingList,
    totalContributions: contributionAgg._sum.amount ?? 0,
    contributionCount: contributionAgg._count,
    openWelfare,
    recentAudit,
    galleryQueue,
    allUsers,
  }
}

export async function getExecutiveDashboardData() {
  const [members, contributions, projects, events, announcements] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.contribution.aggregate({ _sum: { amount: true } }),
    prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 }),
    prisma.event.count({ where: { startsAt: { gte: new Date() } } }),
    prisma.announcement.findMany({
      where: { broadcast: true },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    }),
  ])
  return {
    members,
    totalContributions: contributions._sum.amount ?? 0,
    projects,
    upcomingEvents: events,
    announcements,
  }
}

export async function getTreasurerDashboardData() {
  const [agg, recent, byCategory, pendingWelfare, members] = await Promise.all([
    prisma.contribution.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.contribution.findMany({
      take: 20,
      orderBy: { paidAt: 'desc' },
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.contribution.groupBy({
      by: ['category'],
      _sum: { amount: true },
      _count: true,
    }),
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
    recent,
    byCategory,
    pendingWelfare,
    members,
  }
}

export async function getSecretaryDashboardData() {
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
}

export async function getOrganizerDashboardData() {
  const [events, gallery, projects] = await Promise.all([
    prisma.event.findMany({ orderBy: { startsAt: 'asc' } }),
    prisma.galleryPhoto.findMany({ orderBy: { uploadedAt: 'desc' }, take: 20 }),
    prisma.project.findMany({ orderBy: { updatedAt: 'desc' } }),
  ])
  const upcoming = events.filter((e) => e.startsAt >= new Date())
  return { events, upcoming, gallery, projects }
}

export async function getMemberDashboardData(userId: string) {
  const [contributions, announcements, events, documents, welfare] = await Promise.all([
    prisma.contribution.findMany({
      where: { userId },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.announcement.findMany({
      where: { broadcast: true },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 5,
    }),
    prisma.document.findMany({ orderBy: { uploadedAt: 'desc' }, take: 5 }),
    prisma.welfareRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const total = contributions.reduce((s, c) => s + c.amount, 0)
  return { contributions, total, announcements, events, documents, welfare }
}

export async function getPublicProject(id: string) {
  return prisma.project.findUnique({ where: { id } })
}

export async function getPublicGallery() {
  return prisma.galleryPhoto.findMany({
    where: { isPublic: true },
    orderBy: { uploadedAt: 'desc' },
  })
}

export async function getPublicProjects() {
  return prisma.project.findMany({ orderBy: { updatedAt: 'desc' } })
}

export async function getContributionChartSeries() {
  const rows = await prisma.contribution.findMany({
    select: { amount: true, paidAt: true, category: true },
    orderBy: { paidAt: 'asc' },
  })
  const byMonth = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, '0')}`
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount)
  }
  const labels = [...byMonth.keys()]
  const values = [...byMonth.values()]
  return { labels, values }
}

export async function getContributionAnalytics() {
  const [byMethod, byUser] = await Promise.all([
    prisma.contribution.groupBy({
      by: ['paymentMethod'],
      _sum: { amount: true },
      _count: true,
    }),
    prisma.contribution.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
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
}

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

export async function updateWelfareStatus(
  id: string,
  status: WelfareStatus,
  reviewNote?: string
) {
  return prisma.welfareRequest.update({
    where: { id },
    data: { status, reviewNote },
    include: { user: true },
  })
}

export async function createWelfareRequest(
  userId: string,
  description: string,
  amount?: number
) {
  return prisma.welfareRequest.create({
    data: { userId, description, amount },
  })
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
}) {
  const recipientIds = input.broadcast
    ? (
        await prisma.user.findMany({
          where: { status: 'ACTIVE', id: { not: input.authorId } },
          select: { id: true },
        })
      ).map((u) => u.id)
    : (input.memberIds ?? []).filter((id) => id !== input.authorId)

  return prisma.announcement.create({
    data: {
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      broadcast: input.broadcast,
      receipts: {
        create: recipientIds.map((userId) => ({ userId })),
      },
    },
  })
}

export async function getAnnouncementsForUser(userId: string) {
  return prisma.announcement.findMany({
    where: {
      OR: [{ broadcast: true }, { receipts: { some: { userId } } }],
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    include: {
      author: { select: { fullName: true } },
      receipts: { where: { userId }, select: { readAt: true } },
    },
  })
}

export async function getUnreadAnnouncementCount(userId: string) {
  return prisma.announcementReceipt.count({
    where: { userId, readAt: null },
  })
}

export async function markAnnouncementsRead(userId: string) {
  await prisma.announcementReceipt.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
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

export async function deleteAnnouncement(id: string) {
  return prisma.announcement.delete({ where: { id } })
}

export async function getRecentItems() {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
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
}

export async function getOldAnnouncementsCount() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  return prisma.announcement.count({ where: { publishedAt: { lt: cutoff } } })
}

export async function deleteEvent(id: string) {
  return prisma.event.delete({ where: { id } })
}

export async function deleteEvents(ids: string[]) {
  return prisma.event.deleteMany({ where: { id: { in: ids } } })
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
    data: {
      ...data,
      approvedAt: data.isPublic ? new Date() : null,
    },
  })
}

export async function approveGalleryPhoto(id: string, approve: boolean) {
  return prisma.galleryPhoto.update({
    where: { id },
    data: approve
      ? { isPublic: true, approvedAt: new Date() }
      : { isPublic: false, approvedAt: null },
  })
}

export async function upsertProject(data: {
  id?: string
  title: string
  description: string
  status: ProjectStatus
  imageUrl?: string
  startDate?: Date
  endDate?: Date
}) {
  if (data.id) {
    return prisma.project.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        imageUrl: data.imageUrl,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    })
  }
  return prisma.project.create({
    data: {
      title: data.title,
      description: data.description,
      status: data.status,
      imageUrl: data.imageUrl,
      startDate: data.startDate,
      endDate: data.endDate,
    },
  })
}
