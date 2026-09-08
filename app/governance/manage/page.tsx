import DashboardShell from '@/components/dashboard/DashboardShell'
import GovernanceRecordsClient from '@/components/governance/GovernanceRecordsClient'
import GovernanceManageActions from '@/components/governance/GovernanceManageActions'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { getGovernanceRecordsDetailsForViewer, getResolutionsForViewer } from '@/lib/data/queries'

export default async function ManageGovernancePage() {
  // Only Admin and Secretary may create, upload, and manage governance proposals.
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const [resolutions, proposals] = await Promise.all([
    getResolutionsForViewer(actor),
    getGovernanceRecordsDetailsForViewer(actor),
  ])

  return (
    <DashboardShell
      role={actor.role}
      title="Governance management"
      nav={navForRole(actor.role)}
      pageAction={
        <GovernanceManageActions pending={resolutions.pending} canApprove={resolutions.canApprove} />
      }
    >
      <div className="space-y-5 p-4 md:p-6">
        <section className="space-y-3 rounded-2xl border bg-surface p-5">
          <div className="max-w-3xl">
            <h2 className="font-h3 text-xl text-primary">Proposals</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Create and upload proposals, review responses, and manage visibility for the group.
            </p>
          </div>
          <GovernanceRecordsClient
            records={proposals.map((record) => ({
              id: record.id,
              title: record.title,
              category: record.category,
              createdAt: record.createdAt,
              approveCount: record.approveCount,
              rejectCount: record.rejectCount,
              myVote: record.myVote,
              resultsPublished: record.resultsPublished,
            }))}
            details={proposals}
            canPublish={resolutions.canApprove}
            showVisibility
          />
        </section>
      </div>
    </DashboardShell>
  )
}
