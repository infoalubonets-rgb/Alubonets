import { unstable_cache, revalidateTag } from 'next/cache'
import { appDayRange } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { REVIEWABLE_APPLICANTS } from '@/lib/applicants'
import { announcementAudienceWhere } from '@/lib/notification-audience'
import { formatMonthKeys, formatPaymentMethod, monthKeyFromDate } from '@/lib/chart-labels'
import type { PaymentMethod, ProjectStatus, Role, WelfareStatus } from '@prisma/client'
import { NOT_DELETED_MEMBER } from '@/lib/deleted-member'

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
      prisma.user.count({ where: NOT_DELETED_MEMBER }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: REVIEWABLE_APPLICANTS }),
      prisma.user.findMany({ where: REVIEWABLE_APPLICANTS, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.contribution.aggregate({ where: { status: { in: ['CONFIRMED','RECONCILED'] } }, _sum: { amount: true }, _count: true }),
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
    const [
      members,
      pendingMembers,
      contributions,
      projects,
      events,
      announcements,
      pendingWelfare,
      openActions,
      meetingsPending,
      principals,
    ] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: REVIEWABLE_APPLICANTS }),
      prisma.contribution.aggregate({ where: { status: { in: ['CONFIRMED','RECONCILED'] } }, _sum: { amount: true }, _count: true }),
      prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 }),
      prisma.event.count({ where: { startsAt: { gte: new Date() } } }),
      prisma.announcement.findMany({
        where: { broadcast: true }, orderBy: { publishedAt: 'desc' }, take: 5,
      }),
      prisma.welfareRequest.count({ where: { status: 'PENDING' } }),
      prisma.meetingActionPoint.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } } }),
      prisma.meeting.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.user.count({ where: { isPrincipal: true, status: 'ACTIVE' } }),
    ])
    return {
      members,
      pendingMembers,
      principals,
      totalContributions: contributions._sum.amount ?? 0,
      contributionCount: contributions._count,
      projects,
      upcomingEvents: events,
      announcements,
      pendingWelfare,
      openActions,
      meetingsPending,
    }
  },
  ['executive-dashboard'],
  { tags: [TAGS.members, TAGS.contributions, TAGS.projects, TAGS.events, TAGS.announcements, TAGS.welfare, TAGS.meetings], revalidate: 60 },
)

export async function getTreasurerDashboardDataFresh() {
    const [agg, recent, byCategory, pendingWelfare, members] = await Promise.all([
      prisma.contribution.aggregate({ where: { status: { in: ['CONFIRMED','RECONCILED'] } }, _sum: { amount: true }, _count: true }),
      prisma.contribution.findMany({
        where: { status: { in: ['CONFIRMED','RECONCILED'] } }, take: 20, orderBy: { paidAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      prisma.contribution.groupBy({ by: ['category'], where: { status: { in: ['CONFIRMED','RECONCILED'] } }, _sum: { amount: true }, _count: true }),
      prisma.welfareRequest.findMany({
        where: { status: { in: ['PENDING', 'APPROVED'] } },
        include: {
          user: { select: { fullName: true, email: true } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      }),
    ])
    const now = new Date()
    const monthStart = appDayRange(`${monthKeyFromDate(now)}-01`).start
    const monthAgg = await prisma.contribution.aggregate({
      where: { paidAt: { gte: monthStart, lte: now }, status: { in: ['CONFIRMED','RECONCILED'] } },
      _sum: { amount: true },
    })
    return {
      total: agg._sum.amount ?? 0,
      count: agg._count,
      monthTotal: monthAgg._sum.amount ?? 0,
      recent, byCategory, pendingWelfare, members,
    }
}

export const getTreasurerDashboardData = unstable_cache(
  getTreasurerDashboardDataFresh,
  ['treasurer-dashboard'],
  { tags: [TAGS.contributions, TAGS.welfare, TAGS.members], revalidate: 60 },
)

export const getSecretaryDashboardData = unstable_cache(
  async () => {
    const [documents, meetings, announcements, events, pendingMinutes, openActions] = await Promise.all([
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
      prisma.meeting.findMany({
        where: { status: 'PENDING_APPROVAL' },
        orderBy: { heldAt: 'desc' },
        take: 8,
        select: { id: true, title: true, heldAt: true, status: true },
      }),
      prisma.meetingActionPoint.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } },
        orderBy: { dueAt: 'asc' },
        take: 8,
        include: {
          meeting: { select: { id: true, title: true } },
          owner: { select: { fullName: true } },
        },
      }),
    ])
    const attendanceAvg =
      meetings.length === 0
        ? 0
        : Math.round(meetings.reduce((s, m) => s + m.attendance, 0) / meetings.length)
    return { documents, meetings, announcements, events, attendanceAvg, pendingMinutes, openActions }
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
        id: true, title: true, startsAt: true, location: true, mapsUrl: true,
        description: true, imageUrl: true, isPublic: true,
      },
    })
    const now = new Date()
    const rows = events.map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location ?? null,
      mapsUrl: e.mapsUrl ?? null,
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
    const [contributions, announcements, events, documents, welfare, nextMeeting, projectUpdates, outstanding] = await Promise.all([
      prisma.contribution.findMany({ where: { userId, status: { in: ['CONFIRMED','RECONCILED'] } }, orderBy: { paidAt: 'desc' } }),
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
      prisma.meeting.findFirst({
        where: { heldAt: { gte: new Date() }, status: { in: ['FINAL', 'NOTICE'] } },
        orderBy: { heldAt: 'asc' },
        select: { id: true, title: true, heldAt: true, location: true },
      }),
      prisma.projectUpdate.findMany({
        where: { project: { isPublic: true } },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        include: { project: { select: { id: true, title: true } } },
      }),
      prisma.memberContributionObligation.count({
        where: { userId, status: { in: ['OUTSTANDING', 'PARTIALLY_PAID'] } },
      }),
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
      nextMeeting: nextMeeting
        ? { ...nextMeeting, heldAt: nextMeeting.heldAt.toISOString() }
        : null,
      projectUpdates: projectUpdates.map((update) => ({
        id: update.id,
        title: update.title,
        publishedAt: update.publishedAt.toISOString(),
        projectTitle: update.project.title,
        projectId: update.project.id,
      })),
      outstandingObligations: outstanding,
      latestPaymentStatus: contributions[0]?.status ?? null,
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

/** All projects — the page itself restricts them to paid-up members. */
export const getMemberProjects = unstable_cache(
  async () => prisma.project.findMany({ orderBy: [{ startDate: 'desc' }, { updatedAt: 'desc' }] }),
  ['member-projects'],
  { tags: [TAGS.projects], revalidate: 300 },
)

/** Events for the members' events page; the page decides who may see upcoming vs past. */
export const getPublicEvents = unstable_cache(
  async () => {
    const events = await prisma.event.findMany({
      where: { OR: [{ isPublic: true }, { audienceType: { in: ['PUBLIC', 'ALL_MEMBERS'] } }] },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, description: true, location: true, mapsUrl: true,
        startsAt: true, imageUrl: true,
      },
    })
    const now = new Date()
    const rows = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? null,
      location: e.location ?? null,
      mapsUrl: e.mapsUrl ?? null,
      imageUrl: e.imageUrl ?? null,
      startsAt: e.startsAt.toISOString(),
    }))
    return {
      upcoming: rows.filter((e) => new Date(e.startsAt) >= now),
      past: rows.filter((e) => new Date(e.startsAt) < now).reverse().slice(0, 24),
    }
  },
  ['member-events'],
  { tags: [TAGS.events], revalidate: 300 },
)

export async function getContributionChartSeriesFresh() {
    const rows = await prisma.contribution.findMany({
      where: { status: { in: ['CONFIRMED','RECONCILED'] } },
      select: { amount: true, paidAt: true, category: true },
      orderBy: { paidAt: 'asc' },
    })
    const byMonth = new Map<string, number>()
    for (const row of rows) {
      const key = monthKeyFromDate(row.paidAt)
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount)
    }
    const keys = [...byMonth.keys()]
    return { labels: formatMonthKeys(keys), values: keys.map((k) => byMonth.get(k) ?? 0) }
}

export const getContributionChartSeries = unstable_cache(
  getContributionChartSeriesFresh,
  ['contribution-chart'],
  { tags: [TAGS.contributions], revalidate: 120 },
)

export const getMemberGrowthSeries = unstable_cache(
  async () => {
    const users = await prisma.user.findMany({
      where: NOT_DELETED_MEMBER,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const byMonth = new Map<string, number>()
    let cumulative = 0
    for (const user of users) {
      const key = `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`
      cumulative += 1
      byMonth.set(key, cumulative)
    }
    const keys = [...byMonth.keys()]
    return { labels: formatMonthKeys(keys), values: keys.map((k) => byMonth.get(k) ?? 0) }
  },
  ['member-growth-chart'],
  { tags: [TAGS.members], revalidate: 120 },
)

export const getFamilyBranchDistribution = unstable_cache(
  async () => {
    const principals = await prisma.user.findMany({
      where: { isPrincipal: true, status: 'ACTIVE' },
      select: { fullName: true, _count: { select: { attachedMembers: { where: { status: 'ACTIVE' } } } } },
    })
    const sorted = principals
      .map((principal) => ({ label: principal.fullName, count: principal._count.attachedMembers + 1 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
    return {
      labels: sorted.map((row) => row.label),
      values: sorted.map((row) => row.count),
    }
  },
  ['family-branch-chart'],
  { tags: [TAGS.members], revalidate: 120 },
)

export async function getContributionAnalyticsFresh() {
    const [byMethod, byUser] = await Promise.all([
      prisma.contribution.groupBy({ by: ['paymentMethod'], where: { status: { in: ['CONFIRMED','RECONCILED'] } }, _sum: { amount: true }, _count: true }),
      prisma.contribution.groupBy({
        by: ['userId'], where: { status: { in: ['CONFIRMED','RECONCILED'] } }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } },
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
        label: formatPaymentMethod(m.paymentMethod),
        total: m._sum.amount ?? 0,
        count: m._count,
      })),
      topContributors: top.map((u) => ({
        name: nameById.get(u.userId) ?? 'Unknown member',
        total: u._sum.amount ?? 0,
      })),
    }
}

export const getContributionAnalytics = unstable_cache(
  getContributionAnalyticsFresh,
  ['contribution-analytics'],
  { tags: [TAGS.contributions, TAGS.members], revalidate: 120 },
)

export async function getResolutionsForViewer(actor: { id: string; role: Role; isSuperAdmin?: boolean }) {
  const canApprove = actor.role === 'ADMIN' || Boolean(actor.isSuperAdmin)
  const fullDetail = actor.role === 'ADMIN' || actor.role === 'SECRETARY' || actor.role === 'TREASURER' || Boolean(actor.isSuperAdmin)

  const [pendingRaw, approvedRaw] = await Promise.all([
    canApprove
      ? prisma.resolution.findMany({
          where: { status: 'PENDING_APPROVAL' },
          include: { createdBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.resolution.findMany({
      where: {
        status: 'APPROVED',
        ...(fullDetail ? {} : { visibleToRoles: { has: actor.role } }),
      },
      include: {
        createdBy: { select: { fullName: true } },
        responses: {
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const pending = pendingRaw.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    imageUrl: r.imageUrl,
    documentUrl: r.documentUrl,
    documentName: r.documentName,
    createdByName: r.createdBy.fullName,
    createdAt: r.createdAt.toISOString(),
  }))

  const approved = approvedRaw.map((r) => {
    const approveCount = r.responses.filter((x) => x.vote === 'APPROVE').length
    const rejectCount = r.responses.filter((x) => x.vote === 'REJECT').length
    const mine = r.responses.find((x) => x.userId === actor.id)
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      imageUrl: r.imageUrl,
      documentUrl: r.documentUrl,
      documentName: r.documentName,
      createdByName: r.createdBy.fullName,
      createdAt: r.createdAt.toISOString(),
      resultsPublished: r.resultsPublished,
      approveCount,
      rejectCount,
      myVote: mine?.vote ?? null,
      myComment: mine?.comment ?? null,
      responses: fullDetail
        ? r.responses.map((x) => ({
            userName: x.anonymous ? 'Anonymous member' : x.user.fullName,
            vote: x.vote,
            comment: x.comment,
            createdAt: x.createdAt.toISOString(),
          }))
        : undefined,
    }
  })

  return { pending, approved, canApprove, fullDetail }
}

function canViewGovernanceRecords(actor: { role: Role }) {
  return actor.role === 'ADMIN' || actor.role === 'SECRETARY' || actor.role === 'TREASURER' || actor.role === 'AUDITOR'
}

function governanceRecordWhere(actor: { role: Role }) {
  return {
    status: 'APPROVED' as const,
    ...(canViewGovernanceRecords(actor) ? {} : { visibleToRoles: { has: actor.role } }),
  }
}

export async function getGovernanceRecordsForViewer(actor: { id: string; role: Role }) {
  const details = await getGovernanceRecordsDetailsForViewer(actor)
  return details.map((record) => ({
    id: record.id,
    title: record.title,
    category: record.category,
    createdAt: record.createdAt,
    approveCount: record.approveCount,
    rejectCount: record.rejectCount,
    myVote: record.myVote,
    resultsPublished: record.resultsPublished,
  }))
}

type GovernanceRecordRow = Awaited<ReturnType<typeof prisma.resolution.findFirst>> & {
  createdBy: { fullName: string }
  responses: Array<{
    id: string
    userId: string
    vote: 'APPROVE' | 'REJECT'
    comment: string | null
    anonymous: boolean
    createdAt: Date
    user: { fullName: string }
  }>
}

function mapGovernanceRecordDetail(
  row: NonNullable<GovernanceRecordRow>,
  actor: { id: string; role: Role },
  fullDetail: boolean,
) {
  const mine = row.responses.find((response) => response.userId === actor.id)
  const approveCount = row.responses.filter((response) => response.vote === 'APPROVE').length
  const rejectCount = row.responses.filter((response) => response.vote === 'REJECT').length

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    imageUrl: row.imageUrl,
    documentUrl: row.documentUrl,
    documentName: row.documentName,
    createdByName: row.createdBy.fullName,
    createdAt: row.createdAt.toISOString(),
    resultsPublished: row.resultsPublished,
    allowAnonymous: row.allowAnonymous,
    allowComments: row.allowComments,
    visibleToRoles: row.visibleToRoles,
    approveCount,
    rejectCount,
    myVote: mine?.vote ?? null,
    myComment: mine?.comment ?? null,
    myAnonymous: mine?.anonymous ?? false,
    responses: row.resultsPublished || fullDetail
      ? row.responses.map((response) => ({
          id: response.id,
          userId: response.userId,
          displayName:
            response.userId === actor.id && response.anonymous
                ? 'You (anonymous)'
                : response.anonymous
                  ? 'Anonymous member'
                  : response.user.fullName,
          vote: response.vote,
          comment: response.comment,
          anonymous: response.anonymous,
          createdAt: response.createdAt.toISOString(),
        }))
      : [],
  }
}

export async function getGovernanceRecordsDetailsForViewer(actor: { id: string; role: Role }) {
  const fullDetail = canViewGovernanceRecords(actor)
  const rows = await prisma.resolution.findMany({
    where: governanceRecordWhere(actor),
    include: {
      createdBy: { select: { fullName: true } },
      responses: {
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((row) => mapGovernanceRecordDetail(row, actor, fullDetail))
}

export async function getGovernanceRecordForViewer(id: string, actor: { id: string; role: Role }) {
  const fullDetail = canViewGovernanceRecords(actor)
  const row = await prisma.resolution.findFirst({
    where: { id, ...governanceRecordWhere(actor) },
    include: {
      createdBy: { select: { fullName: true } },
      responses: {
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!row) return null

  return mapGovernanceRecordDetail(row, actor, fullDetail)
}

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
        imageUrl: true,
        publishedAt: true,
        broadcast: true,
        emailSentAt: true,
        expiresAt: true,
        authorId: true,
        author: { select: { fullName: true } },
        receipts: { where: { userId }, select: { readAt: true } },
      },
    }),
  ['announcements-for-user'],
  { tags: [TAGS.announcements], revalidate: 60 },
)

export const getUnreadAnnouncementCount = unstable_cache(
  // Counted for the selected workspace only, matching the Notifications page.
  async (userId: string, workspace: Role) =>
    prisma.announcementReceipt.count({ where: { userId, readAt: null, announcement: announcementAudienceWhere(workspace) } }),
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
    // Serialize dates before caching — unstable_cache JSON-roundtrips Dates to strings,
    // so callers must not assume Date instances.
    return {
      events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      projects: projects.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
      photos: photos.map((p) => ({ ...p, uploadedAt: p.uploadedAt.toISOString() })),
    }
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
      isPublic: p.isPublic,
      progress: p.progress,
      updatedAt: p.updatedAt.toISOString(),
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
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

export async function createAnnouncement(authorId: string, title: string, content: string) {
  return prisma.announcement.create({ data: { authorId, title, content } })
}

export async function sendAnnouncement(input: {
  authorId: string
  title: string
  content: string
  imageUrl?: string
  broadcast: boolean
  memberIds?: string[]
  includeSelf?: boolean
  expiresAt?: Date
  /** Workspaces this announcement belongs to; empty = shown in every workspace. */
  audienceRoles?: Role[]
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
    : (input.memberIds ?? [])

  return prisma.announcement.create({
    data: {
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      imageUrl: input.imageUrl ?? null,
      broadcast: input.broadcast,
      expiresAt: input.expiresAt ?? null,
      audienceRoles: input.audienceRoles ?? [],
      receipts: { create: recipientIds.map((userId) => ({ userId })) },
    },
  })
}

export async function markAnnouncementsRead(userId: string) {
  await prisma.announcementReceipt.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  // Without this the unread-count cache (revalidate: 60) can keep showing the old
  // number for up to a minute after the user just read everything.
  revalidateTag(TAGS.announcements)
}

export async function deleteAnnouncement(id: string) {
  return prisma.announcement.delete({ where: { id } })
}

export async function createEvent(data: {
  title: string
  description?: string
  location?: string
  mapsUrl?: string
  startsAt: Date
  endsAt?: Date
  imageUrl?: string
  isPublic?: boolean
  capacity?: number | null
  reminderOffsetsHours?: number[]
}) {
  const isPublic = data.isPublic !== false
  return prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      mapsUrl: data.mapsUrl,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      imageUrl: data.imageUrl,
      isPublic,
      audienceType: isPublic ? 'PUBLIC' : 'ALL_MEMBERS',
      capacity: data.capacity ?? null,
      reminderOffsetsHours: data.reminderOffsetsHours?.length
        ? data.reminderOffsetsHours
        : [24, 2],
    },
  })
}

export async function updateEvent(id: string, data: {
  title?: string
  description?: string | null
  location?: string | null
  mapsUrl?: string | null
  startsAt?: Date
  imageUrl?: string | null
  isPublic?: boolean
  capacity?: number | null
  reminderOffsetsHours?: number[]
}) {
  const patch: Parameters<typeof prisma.event.update>[0]['data'] = { ...data }
  if (data.isPublic !== undefined) {
    patch.audienceType = data.isPublic ? 'PUBLIC' : 'ALL_MEMBERS'
  }
  return prisma.event.update({ where: { id }, data: patch })
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
  attendees?: string
  membersAbsent?: string
  membersApology?: string
  aob?: string
  nextMeetingAt?: Date
  heldAt: Date
  attendance: number
  recordedBy: string
  status?: 'DRAFT' | 'NOTICE' | 'PENDING_APPROVAL' | 'FINAL'
  eventId?: string | null
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
    attendees?: string | null
    membersAbsent?: string | null
    membersApology?: string | null
    aob?: string | null
    nextMeetingAt?: Date | null
    heldAt?: Date
    attendance?: number
    status?: 'DRAFT' | 'NOTICE' | 'PENDING_APPROVAL' | 'FINAL'
    publishedDocumentId?: string | null
    approvedById?: string | null
    approvedAt?: Date | null
    eventId?: string | null
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
  return prisma.document.create({ data: { ...data, versionGroupId: crypto.randomUUID() } })
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
  isPublic?: boolean
  progress?: number
  startDate?: Date | null
  endDate?: Date | null
}) {
  if (data.id) {
    return prisma.project.update({
      where: { id: data.id },
      data: {
        title: data.title, description: data.description, status: data.status,
        imageUrl: data.imageUrl, isPublic: data.isPublic ?? true, progress: data.progress ?? 0,
        startDate: data.startDate, endDate: data.endDate,
      },
    })
  }
  return prisma.project.create({
    data: {
      title: data.title, description: data.description, status: data.status,
      imageUrl: data.imageUrl, isPublic: data.isPublic ?? true, progress: data.progress ?? 0,
      startDate: data.startDate, endDate: data.endDate,
    },
  })
}
