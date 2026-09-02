import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import WelfareHistoryTable from '@/components/dashboard/WelfareHistoryTable'
import WelfareRequestForm from '@/components/dashboard/WelfareRequestForm'
import WelfareSubmitFeedback from '@/components/dashboard/WelfareSubmitFeedback'
import { actionCreateWelfare } from '@/app/actions/domain'
import { navForRole, withOptionalNav, WELFARE_NAV_ITEMS } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { createClient } from '@/utils/supabase/server'
import { getWelfarePolicy } from '@/lib/settings'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'

export default async function MemberWelfarePage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const welfareOn = await isFeatureEnabled(FEATURE_FLAGS.welfareEnabled)
  if (!welfareOn) notFound()
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  const feedback = await searchParams

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: welfare } = await supabase
    .from('welfare_requests')
    .select('id, status, description, amount, reviewNote, createdAt')
    .eq('userId', profile.id)
    .order('createdAt', { ascending: false })

  const [policy] = await Promise.all([getWelfarePolicy()])
  const requests = welfare ?? []
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length
  const approvedCount = requests.filter((request) => ['APPROVED', 'PAID'].includes(request.status)).length
  const requestedTotal = requests.reduce((total, request) => total + Number(request.amount || 0), 0)
  const money = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

  const nav = withOptionalNav(navForRole('MEMBER'), WELFARE_NAV_ITEMS.member, '/meetings-reports')

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
          <WelfareSubmitFeedback submitted={feedback.submitted === '1'} error={feedback.error === 'limits'} />
          <WelfareRequestForm action={actionCreateWelfare} minAmount={policy.minAmountKes} maxAmount={policy.maxAmountKes} />
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="font-bold text-on-surface">Request history</h2></div>
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">{requests.length}</span>
          </div>
          <WelfareHistoryTable requests={requests} />
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
