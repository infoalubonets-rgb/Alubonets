import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import MarkAnnouncementsRead from '@/components/dashboard/MarkAnnouncementsRead'
import AnnouncementsClient from '@/components/dashboard/AnnouncementsClient'
import TreasurerNotificationsClient from '@/components/dashboard/TreasurerNotificationsClient'
import PaginationBar from '@/components/ui/PaginationBar'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { updateNotificationPreferences } from '@/app/actions/announcements'
import type { Role } from '@/lib/auth/types'
import type { Prisma } from '@prisma/client'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Announcements — Alubonets' }

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/announcements')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  const page = parsePage((await searchParams).page)
  const pageSize = 20
  const canSend =
    ['ADMIN', 'EXECUTIVE', 'ORGANIZER', 'SECRETARY', 'TREASURER'].includes(role) ||
    (profile.isSuperAdmin ?? false)
  const showPaymentNotifs = ['TREASURER', 'ADMIN'].includes(role) || (profile.isSuperAdmin ?? false)

  const announcementWhere = {
    OR: [{ broadcast: true }, { receipts: { some: { userId: profile.id } } }],
  }

  const [announcementTotal, announcements, members, paymentNotifs, pref] = await Promise.all([
    prisma.announcement.count({ where: announcementWhere }),
    prisma.announcement.findMany({
      where: announcementWhere,
      orderBy: { publishedAt: 'desc' },
      skip: paginationSkip(page, pageSize),
      take: pageSize,
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
        receipts: { where: { userId: profile.id }, select: { readAt: true } },
      },
    }),
    canSend
      ? prisma.user.findMany({
          where: { status: 'ACTIVE', id: { not: profile.id } },
          select: { id: true, fullName: true, email: true },
          orderBy: { fullName: 'asc' },
        })
      : Promise.resolve([]),
    showPaymentNotifs
      ? prisma.auditLog.findMany({
          where: { action: 'MPESA_STK_SUCCESS' },
          include: { user: { select: { fullName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),
    prisma.userNotificationPreference.findUnique({ where: { userId: profile.id } }),
  ])

  return (
    <DashboardShell role={role} title="Announcements" nav={navForRole(role)}>
      <MarkAnnouncementsRead />
      <div className="max-w-3xl mx-auto pb-10 space-y-6">
        <section className="rounded-2xl border bg-surface p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-on-surface">Email preference</h2>
          <form action={updateNotificationPreferences} className="mt-2 flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <input type="checkbox" name="emailOptional" defaultChecked={pref?.emailOptional !== false} />{' '}
              Receive optional announcement emails
            </label>
            <button className="text-sm text-primary underline">Save</button>
          </form>
          <p className="mt-1 text-xs text-on-surface-variant">
            Mandatory governance and finance notices always send by email.
          </p>
        </section>
        {showPaymentNotifs && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>payments</span>
              <h2 className="font-semibold text-[13px] text-on-surface uppercase tracking-wider">Payment Notifications</h2>
            </div>
            <TreasurerNotificationsClient
              payments={paymentNotifs.map((p) => ({
                id: p.id,
                createdAt: p.createdAt.toISOString(),
                meta: (p.meta ?? {}) as Prisma.JsonObject,
                user: p.user,
              }))}
            />
            <div className="border-t border-outline-variant my-6" />
          </div>
        )}
        <AnnouncementsClient
          announcements={announcements}
          currentUserId={profile.id}
          isSuperAdmin={profile.isSuperAdmin ?? false}
          canSend={canSend}
          members={members}
        />
        <PaginationBar
          pathname="/announcements"
          page={page}
          totalPages={totalPages(announcementTotal, pageSize)}
        />
      </div>
    </DashboardShell>
  )
}
