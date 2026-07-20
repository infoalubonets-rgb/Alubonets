import DashboardShell from '@/components/dashboard/DashboardShell'
import { EXECUTIVE_NAV } from '@/lib/dashboard/nav'
import { getExecutiveDashboardData, getContributionChartSeries } from '@/lib/data/queries'
import { ContributionTrendChart } from '@/components/dashboard/Charts'
import Link from 'next/link'

export default async function ExecutivePage() {
  const data = await getExecutiveDashboardData()
  const chart = await getContributionChartSeries()

  const stats = [
    { label: 'Active members',   value: data.members,                                              icon: 'group',                  color: 'bg-primary dark:bg-[#0c1e42]',                                               text: 'text-on-primary',                     iconBg: 'bg-white/15' },
    { label: 'Contributions',    value: `KES ${Math.round(data.totalContributions).toLocaleString()}`, icon: 'account_balance_wallet', color: 'bg-secondary dark:bg-[#c45e00]',                                         text: 'text-white',                          iconBg: 'bg-white/15' },
    { label: 'Projects',         value: data.projects.length,                                      icon: 'work',                   color: 'bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30', text: 'text-primary dark:text-blue-200', iconBg: 'bg-primary/15 dark:bg-primary/25' },
    { label: 'Upcoming events',  value: data.upcomingEvents,                                       icon: 'event',                  color: 'bg-secondary/10 dark:bg-[#c45e00]/15 border border-secondary/25',             text: 'text-secondary dark:text-orange-300', iconBg: 'bg-secondary/15' },
  ]

  const quickLinks = [
    { label: 'Projects', description: `${data.projects.length} tracked · manage status and new work`, icon: 'work', href: '/dashboard/executive/projects' },
    { label: 'Announcements', description: `${data.announcements.length} recent updates`, icon: 'campaign', href: '/dashboard/executive/announcements' },
    { label: 'Contributions', description: 'View member contribution records', icon: 'payments', href: '/contributions' },
  ]

  return (
    <DashboardShell role="EXECUTIVE" title="Executive Committee" nav={EXECUTIVE_NAV}>
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

        {/* Contribution trend chart */}
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>
              trending_up
            </span>
            <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">
              Contribution trend
            </h2>
          </div>
          <ContributionTrendChart
            labels={chart.labels.length ? chart.labels : ['—']}
            values={chart.values.length ? chart.values : [0]}
          />
        </section>

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
              <div className="min-w-0">
                <p className="font-semibold text-[13px] text-on-surface dark:text-blue-50">{l.label}</p>
                <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5 line-clamp-2">{l.description}</p>
              </div>
              <span className="material-symbols-outlined text-outline dark:text-blue-200/30 group-hover:text-primary group-hover:translate-x-0.5 ml-auto shrink-0 transition-all" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Recent announcements */}
        {data.announcements.length > 0 && (
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>campaign</span>
                <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Recent announcements</h2>
              </div>
              <Link href="/dashboard/executive/announcements" className="text-[12px] text-primary dark:text-blue-300 hover:underline font-medium">
                View all →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {data.announcements.slice(0, 3).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60 dark:bg-blue-400/60" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 leading-snug">{a.title}</p>
                    {a.publishedAt && (
                      <p className="text-[11px] text-outline dark:text-blue-200/40 mt-0.5">
                        {new Date(a.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
