import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { actionReviewWelfare } from '@/app/actions/domain'
import { recordWelfareDisbursement } from '@/app/actions/finance'
import { getTreasurerDashboardData } from '@/lib/data/queries'
import { prisma } from '@/lib/prisma'

export default async function TreasurerWelfarePage() {
  const data = await getTreasurerDashboardData()
  const accounts = await prisma.financialAccount.findMany({
    where: { active: true, code: { in: ['CASH', 'BANK', 'MPESA', 'WELFARE_FUND'] } },
    orderBy: { name: 'asc' },
  })

  return (
    <DashboardShell role="TREASURER" title="Welfare reviews" nav={TREASURER_NAV}>
      <div className="space-y-4 p-4 md:p-6">
        {data.pendingWelfare.length === 0 && (
          <p className="text-sm text-on-surface-variant rounded-xl border p-4 bg-surface">
            No pending welfare requests.
          </p>
        )}
        {data.pendingWelfare.map((w) => (
          <div key={w.id} className="border rounded-lg p-3 bg-surface">
            <p className="font-medium">
              {w.user.fullName} — {w.description}
            </p>
            <p className="text-sm text-on-surface-variant">
              Amount: {w.amount?.toLocaleString() ?? '—'}
            </p>
            {w.status === 'PENDING' ? <div className="flex gap-2 mt-2">
              {(['APPROVED', 'REJECTED'] as const).map((status) => (
                <form key={status} action={actionReviewWelfare}>
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="status" value={status} />
                  <button className="px-3 py-1.5 border rounded-lg text-xs">{status}</button>
                </form>
              ))}
            </div> : <form action={recordWelfareDisbursement} className="mt-3 grid gap-2 md:grid-cols-4">
              <input type="hidden" name="welfareRequestId" value={w.id} />
              <input name="amount" type="number" min="1" step="0.01" required defaultValue={w.amount ?? undefined} placeholder="KES amount" className="rounded-lg border px-3 py-2" />
              <select name="sourceAccountId" required className="rounded-lg border px-3 py-2">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
              <input name="occurredAt" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="rounded-lg border px-3 py-2" />
              <input name="evidence" type="file" required accept=".pdf,image/*" className="rounded-lg border px-3 py-2" />
              <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Record payment</button>
            </form>}
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
