import DashboardShell from '@/components/dashboard/DashboardShell'
import { ORGANIZER_NAV, SECRETARY_NAV } from '@/lib/dashboard/nav'
import { requireActiveRole } from '@/lib/auth/session'
import { getOrganizerEvents, getActiveMembers } from '@/lib/data/queries'
import OrganizerEventsClient from '@/components/dashboard/OrganizerEventsClient'

export default async function OrganizerEventsPage() {
  const actor = await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  const asSecretary = actor.role === 'SECRETARY'

  const [{ upcoming, past }, members] = await Promise.all([
    getOrganizerEvents(),
    getActiveMembers(),
  ])

  return (
    <DashboardShell role={asSecretary ? 'SECRETARY' : 'ORGANIZER'} title="Events" nav={asSecretary ? SECRETARY_NAV : ORGANIZER_NAV}>
      <OrganizerEventsClient upcoming={upcoming} past={past} members={members} />
    </DashboardShell>
  )
}
