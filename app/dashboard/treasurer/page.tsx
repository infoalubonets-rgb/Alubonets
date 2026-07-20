import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { getTreasurerDashboardData, getContributionChartSeries } from '@/lib/data/queries'
import { BudgetDoughnutChart, ContributionTrendChart } from '@/components/dashboard/Charts'
import Link from 'next/link'

export default async function TreasurerPage() {
  const data = await getTreasurerDashboardData()
  const chart = await getContributionChartSeries()
  const catLabels = data.byCategory.map((c) => c.category || 'Uncategorized')
  const catValues = data.byCategory.map((c) => c._sum.amount ?? 0)

  const hasPendingWelfare = data.pendingWelfare.length > 0
  const stats = [
    { label: 'Total (KES)',     value: Math.round(data.total).toLocaleString(),       icon: 'account_balance',  color: 'bg-primary dark:bg-[#0c1e42]',                                               text: 'text-on-primary',                     iconBg: 'bg-white/15' },
    { label: 'This month',      value: Math.round(data.monthTotal).toLocaleString(),  icon: 'calendar_month',   color: 'bg-secondary dark:bg-[#c45e00]',                                             text: 'text-white',                          iconBg: 'bg-white/15' },
    { label: 'Records',         value: data.count,                                    icon: 'receipt_long',     color: 'bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30', text: 'text-primary dark:text-blue-200', iconBg: 'bg-primary/15 dark:bg-primary/25' },
    { label: 'Pending welfare', value: data.pendingWelfare.length,                    icon: 'volunteer_activism', color: hasPendingWelfare ? 'bg-secondary dark:bg-[#c45e00]' : 'bg-secondary/10 dark:bg-[#c45e00]/15 border border-secondary/25', text: hasPendingWelfare ? 'text-white' : 'text-secondary dark:text-orange-300', iconBg: hasPendingWelfare ? 'bg-white/15' : 'bg-secondary/15' },
  ]

  const quickLinks = [
    { label: 'Contributions', description: 'Record, import CSV, receipts, M-Pesa', icon: 'payments', href: '/dashboard/treasurer/contributions' },
    { label: 'Welfare', description: `${data.pendingWelfare.length} pending review${data.pendingWelfare.length === 1 ? '' : 's'}`, icon: 'volunteer_activism', href: '/dashboard/treasurer/welfare', badge: data.pendingWelfare.length > 0 ? data.pendingWelfare.length : null },
    { label: 'My contributions', description: 'View your own contribution history', icon: 'savings', href: '/contributions' },
  ]

  return (
    <DashboardShell role="TREASURER" title="Treasurer" nav={TREASURER_NAV}>
      <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className={`relative overflow-hidden rounded-2xl ${s.color} p-4 shadow-sm`}>
              <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-black/[0.04] dark:bg-white/[0.05]" />
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconBg}`}>
                <span className={`material-symbols-outlined icon-fill ${s.text}`} style={{ fontSize: 18 }}>
                  {s.icon}
                </span>
              </div>
              <p className={`mt-3 text-[22px] font-bold leading-none tracking-tight ${s.text}`}>{s.value}</p>
              <p className={`mt-1 text-[11px] font-medium uppercase tracking-wider ${s.text} opacity-60`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>trending_up</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Trend</h2>
            </div>
            <ContributionTrendChart
              labels={chart.labels.length ? chart.labels : ['—']}
              values={chart.values.length ? chart.values : [0]}
            />
          </section>
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>donut_large</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">By category</h2>
            </div>
            <BudgetDoughnutChart
              labels={catLabels.length ? catLabels : ['None']}
              values={catValues.length ? catValues : [0]}
            />
          </section>
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-3 gap-3">
          {quickLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="group flex items-center gap-3 rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 20 }}>
                  {l.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[13px] text-on-surface dark:text-blue-50">{l.label}</p>
                  {l.badge != null && (
                    <span className="rounded-full bg-secondary text-on-primary text-[10px] font-bold px-1.5 py-0.5 leading-none">
                      {l.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5 line-clamp-2">{l.description}</p>
              </div>
              <span className="material-symbols-outlined text-outline dark:text-blue-200/30 group-hover:text-primary group-hover:translate-x-0.5 shrink-0 transition-all" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Recent contributions */}
        {data.recent.length > 0 && (
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>receipt_long</span>
                <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Recent contributions</h2>
              </div>
              <Link href="/dashboard/treasurer/contributions" className="text-[12px] text-primary dark:text-blue-300 hover:underline font-medium">
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-outline-variant dark:divide-[#1a2d4f]">
              {data.recent.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-on-surface dark:text-blue-50 truncate">{c.user.fullName}</p>
                    <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                      {c.paidAt ? new Date(c.paidAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      {c.category ? ` · ${c.category}` : ''}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold text-primary dark:text-blue-200 shrink-0">
                    KES {Math.round(c.amount).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
