import DashboardShell from '@/components/dashboard/DashboardShell'
import GovernanceRecordsTable from '@/components/governance/GovernanceRecordsTable'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { getGovernanceRecordsForViewer } from '@/lib/data/queries'

export default async function GovernancePage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
  ])
  const records = await getGovernanceRecordsForViewer(actor)

  return (
    <DashboardShell role={actor.role} title="Governance" nav={navForRole(actor.role)}>
      <div className="p-4 md:p-6">
        <GovernanceRecordsTable records={records} />
      </div>
    </DashboardShell>
  )
}
