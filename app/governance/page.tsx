import DashboardShell from '@/components/dashboard/DashboardShell'
import GovernanceRecordsClient from '@/components/governance/GovernanceRecordsClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { getGovernanceRecordsDetailsForViewer } from '@/lib/data/queries'

export default async function GovernancePage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
    'AUDITOR',
  ])
  const details = await getGovernanceRecordsDetailsForViewer(actor)

  return (
    <DashboardShell role={actor.role} title="Governance" nav={navForRole(actor.role)}>
      <div className="p-4 md:p-6">
        <GovernanceRecordsClient
          records={details.map((record) => ({
            id: record.id,
            title: record.title,
            category: record.category,
            createdAt: record.createdAt,
            approveCount: record.approveCount,
            rejectCount: record.rejectCount,
            myVote: record.myVote,
            resultsPublished: record.resultsPublished,
          }))}
          details={details}
          readOnly={actor.role === 'AUDITOR'}
        />
      </div>
    </DashboardShell>
  )
}
