import DashboardShell from '@/components/dashboard/DashboardShell'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { getAdminDashboardData, getContributionChartSeries, getMemberGrowthSeries, getFamilyBranchDistribution } from '@/lib/data/queries'
import {
  ApprovalStatusChart,
  ChartEmpty,
  ContributionTrendChart,
  FamilyBranchChart,
  MemberGrowthChart,
} from '@/components/dashboard/Charts'
import { hasChartData, formatMemberStatus } from '@/lib/chart-labels'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatAuditAction } from '@/lib/audit-labels'
import { requireAdmin } from '@/lib/auth/session'

export default async function AdminPage() {
  await requireAdmin()
  const data = await getAdminDashboardData()
  const [chart, memberGrowth, familyBranches] = await Promise.all([
    getContributionChartSeries(),
    getMemberGrowthSeries(),
    getFamilyBranchDistribution(),
  ])
  const statusCounts = await prisma.user.groupBy({ by: ['status'], _count: true })
  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]))
  const nav = await navWithLoans('ADMIN')

  const stats = [
    { label: 'Total members',       value: data.totalMembers,                                    icon: 'group',                  href: '/directory',  color: 'bg-primary dark:bg-[#0c1e42]',           text: 'text-white', iconBg: 'bg-white/15' },
    { label: 'Active',              value: data.activeMembers,                                   icon: 'verified_user',          href: '/directory?status=ACTIVE',  color: 'bg-secondary-container dark:bg-[#c45e00]', text: 'text-white', iconBg: 'bg-white/15' },
    { label: 'Pending approval',    value: data.pendingMembers,                                  icon: 'pending_actions',        href: '/admin/approvals', color: 'bg-primary-container dark:bg-[#153060]',  text: 'text-white', iconBg: 'bg-white/15' },
    { label: 'Contributions (KES)', value: Math.round(data.totalContributions).toLocaleString(), icon: 'account_balance_wallet', href: null,               color: 'bg-secondary dark:bg-[#7a3a00]',          text: 'text-white', iconBg: 'bg-white/15' },
  ]

  const quickLinks = [
    { label: 'Members', description: 'Every member and account, with role filters', icon: 'manage_accounts', href: '/directory' },
    { label: 'Activities', description: 'What is happening today and this week', icon: 'today', href: '/today' },
    { label: 'Approvals', description: `${data.pendingMembers} pending registration${data.pendingMembers === 1 ? '' : 's'}`, icon: 'pending_actions', href: '/admin/approvals', badge: data.pendingMembers > 0 ? data.pendingMembers : null },
    { label: 'Gallery queue', description: `${data.galleryQueue.length} awaiting publish`, icon: 'photo_library', href: '/admin/gallery-queue', badge: data.galleryQueue.length > 0 ? data.galleryQueue.length : null },
    { label: 'Roles & access', description: 'Assign primary role and dashboards', icon: 'admin_panel_settings', href: '/admin/roles' },
    { label: 'Communications', description: 'Send notifications to members', icon: 'campaign', href: '/admin/announcements' },
    { label: 'Activity logs', description: 'Full audit trail', icon: 'history', href: '/admin/audit-logs' },
  ]

  return (
    <DashboardShell role="ADMIN" title="Administrator" nav={nav}>
      <div className="mx-auto max-w-7xl space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((s) => {
            const inner = (
              <div className={`relative overflow-hidden rounded-2xl ${s.color} p-4 shadow-sm h-full`}>
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-black/[0.04] dark:bg-white/[0.05]" />
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconBg}`}>
                  <span className={`material-symbols-outlined icon-fill ${s.text}`} style={{ fontSize: 18 }}>
                    {s.icon}
                  </span>
                </div>
                <p className={`mt-3 text-[22px] font-bold leading-none tracking-tight ${s.text}`}>{s.value}</p>
                <p className={`mt-1 text-[11px] font-medium uppercase tracking-wider ${s.text} opacity-60`}>{s.label}</p>
              </div>
            )
            return s.href ? (
              <Link key={s.label} href={s.href} className="hover:opacity-90 transition-opacity rounded-2xl">
                {inner}
              </Link>
            ) : (
              <div key={s.label}>{inner}</div>
            )
          })}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>trending_up</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Contribution trend</h2>
            </div>
            {hasChartData(chart.values) ? (
              <ContributionTrendChart labels={chart.labels} values={chart.values} />
            ) : (
              <ChartEmpty message="No confirmed contributions recorded yet." />
            )}
          </section>
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>donut_large</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Membership status</h2>
            </div>
            <ApprovalStatusChart
              labels={['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED'].map(formatMemberStatus)}
              values={[statusMap.ACTIVE ?? 0, statusMap.PENDING ?? 0, statusMap.INACTIVE ?? 0, statusMap.SUSPENDED ?? 0]}
            />
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>groups</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Member growth</h2>
            </div>
            {hasChartData(memberGrowth.values) ? (
              <MemberGrowthChart labels={memberGrowth.labels} values={memberGrowth.values} />
            ) : (
              <ChartEmpty message="No member registrations yet." />
            )}
          </section>
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>family_history</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Members per Principal</h2>
            </div>
            {hasChartData(familyBranches.values) ? (
              <FamilyBranchChart labels={familyBranches.labels} values={familyBranches.values} />
            ) : (
              <ChartEmpty message="No Principal members yet." />
            )}
          </section>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5 line-clamp-1">{l.description}</p>
              </div>
              <span className="material-symbols-outlined text-outline dark:text-blue-200/30 group-hover:text-primary group-hover:translate-x-0.5 shrink-0 transition-all" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>history</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Recent activity</h2>
            </div>
            <Link href="/admin/audit-logs" className="text-[12px] text-primary dark:text-blue-300 hover:underline font-medium">
              View all →
            </Link>
          </div>
          {data.recentAudit.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-outline-variant dark:divide-[#1a2d4f]">
              {data.recentAudit.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-on-surface dark:text-blue-50">
                      {formatAuditAction(a.action)}
                    </p>
                    <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                      by {a.user?.fullName || 'System'}
                    </p>
                  </div>
                  <span className="text-[11px] text-outline dark:text-blue-200/30 shrink-0 mt-0.5">
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
