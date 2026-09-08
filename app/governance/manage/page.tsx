import DashboardShell from '@/components/dashboard/DashboardShell'
import GovernanceRecordsClient from '@/components/governance/GovernanceRecordsClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { getGovernanceRecordsDetailsForViewer, getResolutionsForViewer } from '@/lib/data/queries'
import CreateResolutionForm from '@/components/governance/CreateResolutionForm'
import PendingApprovalsPanel from '@/components/governance/PendingApprovalsPanel'
import IconModalButton from '@/components/ui/IconModalButton'

export default async function ManageGovernancePage() {
  // Only Admin and Secretary may create, upload, and manage governance proposals.
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const [resolutions, proposals] = await Promise.all([
    getResolutionsForViewer(actor),
    getGovernanceRecordsDetailsForViewer(actor),
  ])

  const pageAction = (
    <div className="flex items-center gap-2">
      {resolutions.canApprove && (
        <IconModalButton icon="settings" label="Pending approvals" title="Pending approvals" showText>
          <PendingApprovalsPanel pending={resolutions.pending} />
        </IconModalButton>
      )}
      <IconModalButton icon="add" label="New proposal" title="Share a proposal for approval" showText>
        {({ close, reopen }) => <CreateResolutionForm onClose={close} onReopen={reopen} />}
      </IconModalButton>
    </div>
  )

  return (
    <DashboardShell role={actor.role} title="Governance management" nav={navForRole(actor.role)} pageAction={pageAction}>
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
