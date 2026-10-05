import DashboardShell from '@/components/dashboard/DashboardShell'
import { ORGANIZER_NAV } from '@/lib/dashboard/nav'
import { getActiveMembers, getOrganizerProjects } from '@/lib/data/queries'
import OrganizerProjectsClient, { NewProjectButton } from '@/components/dashboard/OrganizerProjectsClient'

export default async function OrganizerProjectsPage() {
  const [projects, members] = await Promise.all([
    getOrganizerProjects(),
    getActiveMembers(),
  ])

  return (
    <DashboardShell role="ORGANIZER" title="Projects" nav={ORGANIZER_NAV} pageAction={<NewProjectButton />}>
      <OrganizerProjectsClient projects={projects} members={members} />
    </DashboardShell>
  )
}
