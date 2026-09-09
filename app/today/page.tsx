import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import TodayActivitiesClient from '@/components/dashboard/TodayActivitiesClient'
import { navForRole } from '@/lib/dashboard/nav'
import { requireActiveRole } from '@/lib/auth/session'
import { listTodayActivities, createDailyActivity } from '@/app/actions/activities'
import type { Role } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Today / Activities — Alubonets' }

export default async function TodayPage() {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  if (actor.status !== 'ACTIVE') redirect('/login?error=inactive')

  const activities = await listTodayActivities()

  const canCreate = ['ADMIN', 'SECRETARY', 'ORGANIZER', 'EXECUTIVE'].includes(actor.role) || actor.isSuperAdmin

  return (
    <DashboardShell role={actor.role as Role} title="Today / Activities" nav={navForRole(actor.role as Role)}>
      <TodayActivitiesClient
        activities={activities}
        canCreate={canCreate}
        createAction={createDailyActivity}
      />
    </DashboardShell>
  )
}
