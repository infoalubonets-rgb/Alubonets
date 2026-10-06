import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ModuleDisabled from '@/components/dashboard/ModuleDisabled'
import WelfareHistoryTable from '@/components/dashboard/WelfareHistoryTable'
import WelfareRequestForm from '@/components/dashboard/WelfareRequestForm'
import WelfareSubmitFeedback from '@/components/dashboard/WelfareSubmitFeedback'
import { actionCreateWelfare } from '@/app/actions/welfare'
import { navForRole, withOptionalNav, WELFARE_NAV_ITEMS } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { getWelfarePolicy } from '@/lib/settings'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { prisma } from '@/lib/prisma'

export default async function MemberWelfarePage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const welfareOn = await isFeatureEnabled(FEATURE_FLAGS.welfareEnabled)
  if (!welfareOn) return <ModuleDisabled module="Welfare" />
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  const feedback = await searchParams

  const [policy, requests, categories] = await Promise.all([
    getWelfarePolicy(),
    prisma.welfareRequest.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        description: true,
        amount: true,
        reviewNote: true,
        createdAt: true,
        treasurerApprovedAt: true,
        executiveApprovedAt: true,
      },
    }),
    prisma.welfareCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ])
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length
  const approvedCount = requests.filter((request) => ['APPROVED', 'PAID'].includes(request.status)).length
  const requestedTotal = requests.reduce((total, request) => total + Number(request.amount || 0), 0)
  const money = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

  const nav = withOptionalNav(navForRole('MEMBER'), WELFARE_NAV_ITEMS.member, '/contributions')

  return (
    <DashboardShell role="MEMBER" title="Welfare" nav={nav}>
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon="receipt_long" label="All requests" value={String(requests.length)} />
          <SummaryCard icon="pending_actions" label="Awaiting review" value={String(pendingCount)} />
          <SummaryCard icon="account_balance_wallet" label="Total requested" value={money.format(requestedTotal)} detail={`${approvedCount} approved or paid`} />
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined">volunteer_activism</span></span>
            <h2 className="font-bold text-on-surface">Request welfare support</h2>
          </div>
          <p className="mb-4 text-sm text-on-surface-variant">
            Requests need both Treasurer and Executive approval. Mark a request confidential if only welfare officers should see beneficiary details.
          </p>
          <WelfareSubmitFeedback submitted={feedback.submitted === '1'} error={feedback.error === 'limits'} />
          <WelfareRequestForm
            action={actionCreateWelfare}
            minAmount={policy.minAmountKes}
            maxAmount={policy.maxAmountKes}
            categories={categories}
          />
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="font-bold text-on-surface">Request history</h2></div>
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">{requests.length}</span>
          </div>
          <WelfareHistoryTable
            requests={requests.map((request) => ({
              ...request,
              createdAt: request.createdAt.toISOString(),
            }))}
          />
        </section>
      </div>
    </DashboardShell>
  )
}

function SummaryCard({ icon, label, value, detail }: { icon: string; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface p-4 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined text-[20px]">{icon}</span></span>
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className="truncate text-lg font-black text-on-surface">{value}</p>{detail && <p className="text-[10px] text-on-surface-variant">{detail}</p>}</div>
    </div>
  )
}
