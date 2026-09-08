'use client'

import CreateResolutionForm from '@/components/governance/CreateResolutionForm'
import IconModalButton from '@/components/ui/IconModalButton'
import PendingApprovalsPanel, { type PendingResolution } from '@/components/governance/PendingApprovalsPanel'

/** Client wrapper so close/reopen callbacks stay on the client (not passed from a Server Component). */
export default function GovernanceManageActions({
  pending,
  canApprove,
}: {
  pending: PendingResolution[]
  canApprove: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {canApprove && (
        <IconModalButton icon="settings" label="Pending approvals" title="Pending approvals" showText>
          <PendingApprovalsPanel pending={pending} />
        </IconModalButton>
      )}
      <IconModalButton icon="add" label="New proposal" title="Share a proposal for approval" showText>
        {({ close, reopen }) => <CreateResolutionForm onClose={close} onReopen={reopen} />}
      </IconModalButton>
    </div>
  )
}
