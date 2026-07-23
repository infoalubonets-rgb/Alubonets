import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import TreasurerNotificationsClient from '@/components/dashboard/TreasurerNotificationsClient'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

export default async function TreasurerNotificationsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  if (!['TREASURER', 'ADMIN'].includes(profile.role)) redirect('/dashboard/treasurer')

  const payments = await prisma.auditLog.findMany({
    where: { action: 'MPESA_STK_SUCCESS' },
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <DashboardShell role="TREASURER" title="Notifications" nav={TREASURER_NAV}>
      <TreasurerNotificationsClient
        payments={payments.map((p) => ({
          id: p.id,
          createdAt: p.createdAt.toISOString(),
          meta: (p.meta ?? {}) as Prisma.JsonObject,
          user: p.user,
        }))}
      />
    </DashboardShell>
  )
}
