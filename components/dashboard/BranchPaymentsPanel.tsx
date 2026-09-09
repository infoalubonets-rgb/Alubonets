import { getBranchContributionSummary } from '@/app/actions/finance'

export default async function BranchPaymentsPanel() {
  // The branch is resolved from the session inside the action — nothing is passed from the page.
  const summary = await getBranchContributionSummary()
  return (
    <section className="rounded-2xl border border-outline-variant/70 bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-primary">Branch payments</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Confirmed payments from you and attached members.
          </p>
        </div>
        <p className="text-lg font-bold text-primary">KES {Math.round(summary.total).toLocaleString()}</p>
      </div>
      <ul className="mt-3 divide-y text-sm">
        {summary.rows.slice(0, 12).map((row) => (
          <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              <b>{row.memberName}</b>
              {' · '}
              {row.purpose}
              {' · '}
              <span className="text-xs uppercase text-on-surface-variant">{row.status}</span>
            </span>
            <span>
              KES {Math.round(row.amount).toLocaleString()}
              <span className="ml-2 text-xs text-on-surface-variant">
                {new Date(row.paidAt).toLocaleDateString('en-KE')}
              </span>
            </span>
          </li>
        ))}
        {!summary.rows.length && <li className="py-2 text-on-surface-variant">No branch payments yet.</li>}
      </ul>
    </section>
  )
}
