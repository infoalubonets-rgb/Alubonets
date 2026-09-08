import DashboardShell from '@/components/dashboard/DashboardShell'
import GovernanceRecordsClient from '@/components/governance/GovernanceRecordsClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { getGovernanceRecordsDetailsForViewer, getResolutionsForViewer } from '@/lib/data/queries'
import CreateResolutionForm from '@/components/governance/CreateResolutionForm'
import PendingApprovalsPanel from '@/components/governance/PendingApprovalsPanel'
import IconModalButton from '@/components/ui/IconModalButton'

const RESOLUTION_CREATOR_ROLES = ['SECRETARY', 'ORGANIZER', 'TREASURER', 'ADMIN']

export default async function ManageGovernancePage() {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE'])
  const canManage = actor.role === 'ADMIN' || actor.role === 'SECRETARY'
  const canCreateResolution = RESOLUTION_CREATOR_ROLES.includes(actor.role)
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
      {canCreateResolution && (
        <IconModalButton icon="add" label="New proposal" title="Share a proposal for approval" showText>
          <CreateResolutionForm />
        </IconModalButton>
      )}
    </div>
  )

  return (
    <DashboardShell role={actor.role} title="Governance management" nav={navForRole(actor.role)} pageAction={pageAction}>
      <div className="space-y-5 p-4 md:p-6">
        {canManage && (
          <section className="space-y-3 rounded-2xl border bg-surface p-5">
            <div className="max-w-3xl">
              <h2 className="font-h3 text-xl text-primary">Proposals</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Review proposals, vote, and add optional comments for the group.
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
              showVisibility={canManage}
            />
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
