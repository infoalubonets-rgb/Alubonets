import DashboardShell from '@/components/dashboard/DashboardShell'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { getTreasurerDashboardData, getContributionChartSeries, getContributionAnalytics } from '@/lib/data/queries'
import { BudgetDoughnutChart, ChartEmpty, ContributionTrendChart, TopContributorsChart } from '@/components/dashboard/Charts'
import { hasChartData } from '@/lib/chart-labels'
import Link from 'next/link'

export default async function TreasurerPage() {
  const [data, chart, analytics, nav] = await Promise.all([
    getTreasurerDashboardData(),
    getContributionChartSeries(),
    getContributionAnalytics(),
    navWithLoans('TREASURER'),
  ])

  const catLabels = data.byCategory.map((c) => c.category || 'Uncategorized')
  const catValues = data.byCategory.map((c) => c._sum.amount ?? 0)
  const topLabels = analytics.topContributors.map((t) => t.name)
  const topValues = analytics.topContributors.map((t) => t.total)

  const stats = [
    { label: 'Total (KES)',     value: Math.round(data.total).toLocaleString(),      icon: 'account_balance',    color: 'bg-primary dark:bg-[#0c1e42]',           text: 'text-white', iconBg: 'bg-white/15' },
    { label: 'This month',      value: Math.round(data.monthTotal).toLocaleString(), icon: 'calendar_month',     color: 'bg-secondary-container dark:bg-[#c45e00]', text: 'text-white', iconBg: 'bg-white/15' },
    { label: 'Records',         value: data.count,                                   icon: 'receipt_long',       color: 'bg-primary-container dark:bg-[#153060]',  text: 'text-white', iconBg: 'bg-white/15' },
    { label: 'Pending welfare', value: data.pendingWelfare.length,                   icon: 'volunteer_activism', color: 'bg-secondary dark:bg-[#7a3a00]',          text: 'text-white', iconBg: 'bg-white/15' },
  ]

  const quickLinks = [
    { label: 'Contributions & Payments', description: 'Record contributions, M-Pesa payments, receipts', icon: 'payments', href: '/dashboard/treasurer/contributions' },
    { label: 'Welfare', description: `${data.pendingWelfare.length} pending review${data.pendingWelfare.length === 1 ? '' : 's'}`, icon: 'volunteer_activism', href: '/dashboard/treasurer/welfare', badge: data.pendingWelfare.length > 0 ? data.pendingWelfare.length : null },
    { label: 'Announcements', description: 'Group announcements & payment notifications', icon: 'campaign', href: '/announcements' },
  ]

  return (
    <DashboardShell role="TREASURER" title="Treasurer" nav={nav}>
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

        {/* Line chart — full width */}
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>trending_up</span>
            <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Monthly contribution trend</h2>
          </div>
          {hasChartData(chart.values) ? (
            <ContributionTrendChart labels={chart.labels} values={chart.values} />
          ) : (
            <ChartEmpty message="No confirmed contributions recorded yet." />
          )}
        </section>

        {/* Bar + Donut side by side */}
        <div className="grid lg:grid-cols-5 gap-4">
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>leaderboard</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Top contributors</h2>
            </div>
            {hasChartData(topValues) ? (
              <TopContributorsChart labels={topLabels} values={topValues} />
            ) : (
              <ChartEmpty message="No contributor data yet." />
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>donut_large</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">By category</h2>
            </div>
            {hasChartData(catValues) ? (
              <BudgetDoughnutChart labels={catLabels} values={catValues} />
            ) : (
              <ChartEmpty message="No contributions by category yet." />
            )}
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
