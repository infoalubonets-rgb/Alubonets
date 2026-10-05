import DashboardShell from '@/components/dashboard/DashboardShell'
import { EXECUTIVE_NAV } from '@/lib/dashboard/nav'
import { getActiveMembers, getOrganizerProjects } from '@/lib/data/queries'
import OrganizerProjectsClient, { NewProjectButton } from '@/components/dashboard/OrganizerProjectsClient'

export default async function ExecutiveProjectsPage() {
  const [projects, members] = await Promise.all([
    getOrganizerProjects(),
    getActiveMembers(),
  ])

  return (
    <DashboardShell role="EXECUTIVE" title="Projects" nav={EXECUTIVE_NAV} pageAction={<NewProjectButton />}>
      <OrganizerProjectsClient
        projects={projects}
        members={members}
        manageHrefBase="/dashboard/executive/projects"
      />
    </DashboardShell>
  )
}
