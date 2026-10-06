import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import TodayActivitiesClient from '@/components/dashboard/TodayActivitiesClient'
import NewActivityButton from '@/components/dashboard/NewActivityButton'
import { navForRole } from '@/lib/dashboard/nav'
import { requireActiveRole } from '@/lib/auth/session'
import {
  listUpcomingActivities,
  createDailyActivity,
  deleteDailyActivity,
  prepareActivityImageUpload,
} from '@/app/actions/activities'
import type { Role } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Activities — Alubonets' }

export default async function TodayPage() {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  if (actor.status !== 'ACTIVE') redirect('/login?error=inactive')

  const activities = await listUpcomingActivities()

  const canCreate = ['ADMIN', 'SECRETARY', 'ORGANIZER', 'EXECUTIVE'].includes(actor.role) || actor.isSuperAdmin

  return (
    <DashboardShell
      role={actor.role as Role}
      title="Activities"
      nav={navForRole(actor.role as Role)}
      pageAction={canCreate ? <NewActivityButton createAction={createDailyActivity} prepareImageUpload={prepareActivityImageUpload} /> : undefined}
    >
      <TodayActivitiesClient activities={activities} deleteAction={deleteDailyActivity} />
    </DashboardShell>
  )
}
