import { actionReviewWelfare } from '@/app/actions/welfare'
import { publishFundingRequestToGovernance } from '@/app/actions/loans'
import RecordWelfareDisbursementForm from '@/components/finance/RecordWelfareDisbursementForm'

export type WelfareReviewRequest = {
  id: string
  description: string
  amount: number | null
  status: string
  confidentiality: string
  beneficiaryName: string | null
  supportType: string | null
  reviewNote: string | null
  treasurerApprovedAt: Date | string | null
  executiveApprovedAt: Date | string | null
  user: { fullName: string; email: string }
  category?: { name: string } | null
}

type AccountOption = { id: string; name: string; code: string }

export default function WelfareReviewCard({
  request,
  office,
  accounts,
}: {
  request: WelfareReviewRequest
  office: 'TREASURER' | 'EXECUTIVE'
  accounts?: AccountOption[]
}) {
  const confidential = request.confidentiality === 'CONFIDENTIAL'
  const treasurerDone = Boolean(request.treasurerApprovedAt)
  const executiveDone = Boolean(request.executiveApprovedAt)
  const thisOfficeDone = office === 'TREASURER' ? treasurerDone : executiveDone
  const pending = request.status === 'PENDING'

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-on-surface">
            {confidential ? 'Confidential request' : request.user.fullName}
            {' — '}
            {request.amount != null ? `KES ${Math.round(request.amount).toLocaleString()}` : 'Amount not set'}
          </p>
          <p className="text-sm text-on-surface-variant mt-0.5">{request.description}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          confidential ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
        }`}>
          {confidential ? 'Confidential' : 'Standard'}
        </span>
      </div>
      <dl className="grid gap-1 text-xs text-on-surface-variant sm:grid-cols-2">
        {!confidential && <div>Requester: {request.user.fullName}</div>}
        {request.beneficiaryName && <div>Beneficiary: {request.beneficiaryName}</div>}
        {request.supportType && <div>Support type: {request.supportType}</div>}
        {request.category?.name && <div>Category: {request.category.name}</div>}
        <div>Treasurer: {treasurerDone ? 'Approved' : 'Awaiting'}</div>
        <div>Executive: {executiveDone ? 'Approved' : 'Awaiting'}</div>
      </dl>
      {pending && (
        <>
          <form action={publishFundingRequestToGovernance}>
            <input type="hidden" name="requestType" value="WELFARE" />
            <input type="hidden" name="requestId" value={request.id} />
            <button className="rounded-full border border-primary px-3 py-1.5 text-xs font-bold text-primary">
              Publish to Governance
            </button>
          </form>
          {!thisOfficeDone ? (
            <div className="flex flex-wrap gap-2">
              {(['APPROVED', 'REJECTED'] as const).map((status) => (
                <form key={status} action={actionReviewWelfare} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={request.id} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="office" value={office} />
                  <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
                    {status === 'APPROVED' ? `Approve as ${office === 'TREASURER' ? 'Treasurer' : 'Executive'}` : 'Reject'}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">
              This office has approved. Waiting for the other officer.
            </p>
          )}
        </>
      )}
      {request.status === 'APPROVED' && office === 'TREASURER' && accounts && (
        <RecordWelfareDisbursementForm
          welfareRequestId={request.id}
          defaultAmount={request.amount}
          accounts={accounts}
        />
      )}
    </div>
  )
}
