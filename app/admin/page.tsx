import DashboardShell, { type NavItem } from '@/components/dashboard/DashboardShell'
import { setMemberApproval, setMemberRole } from '@/app/actions/members'
import { actionApproveGallery } from '@/app/actions/domain'
import { getAdminDashboardData, getContributionChartSeries } from '@/lib/data/queries'
import {
  ApprovalStatusChart,
  ContributionTrendChart,
  MemberGrowthChart,
} from '@/components/dashboard/Charts'
import { prisma } from '@/lib/prisma'

const NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', active: true },
  { icon: 'group', label: 'Members' },
  { icon: 'pending_actions', label: 'Approvals' },
  { icon: 'photo_library', label: 'Gallery queue' },
  { icon: 'admin_panel_settings', label: 'Roles' },
]

export default async function AdminPage() {
  const data = await getAdminDashboardData()
  const chart = await getContributionChartSeries()
  const statusCounts = await prisma.user.groupBy({
    by: ['status'],
    _count: true,
  })
  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]))

  return (
    <DashboardShell role="ADMIN" title="Administrator" nav={NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total members', value: data.totalMembers },
            { label: 'Active', value: data.activeMembers },
            { label: 'Pending', value: data.pendingMembers },
            {
              label: 'Contributions (KES)',
              value: Math.round(data.totalContributions).toLocaleString(),
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-outline-variant/40 bg-surface p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-outline-variant/40 bg-surface p-4">
            <h2 className="font-semibold mb-3">Contribution trend</h2>
            <ContributionTrendChart
              labels={chart.labels.length ? chart.labels : ['—']}
              values={chart.values.length ? chart.values : [0]}
            />
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface p-4">
            <h2 className="font-semibold mb-3">Membership status</h2>
            <ApprovalStatusChart
              labels={['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED']}
              values={[
                statusMap.ACTIVE ?? 0,
                statusMap.PENDING ?? 0,
                statusMap.INACTIVE ?? 0,
                statusMap.SUSPENDED ?? 0,
              ]}
            />
          </div>
        </div>

        <section className="rounded-xl border border-outline-variant/40 bg-surface p-4">
          <h2 className="font-semibold mb-3">Pending registrations ({data.pendingList.length})</h2>
          <div className="space-y-2">
            {data.pendingList.length === 0 && (
              <p className="text-sm text-on-surface-variant">No pending members.</p>
            )}
            {data.pendingList.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-outline-variant/30 rounded-lg p-3"
              >
                <div>
                  <p className="font-medium">{u.fullName}</p>
                  <p className="text-sm text-on-surface-variant">{u.email}</p>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      'use server'
                      await setMemberApproval({ userId: u.id, approve: true })
                    }}
                  >
                    <button className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-sm">
                      Approve
                    </button>
                  </form>
                  <form
                    action={async () => {
                      'use server'
                      await setMemberApproval({ userId: u.id, approve: false })
                    }}
                  >
                    <button className="px-3 py-1.5 rounded-lg border text-sm">Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface p-4">
          <h2 className="font-semibold mb-3">Gallery approval queue</h2>
          <div className="space-y-2">
            {data.galleryQueue.length === 0 && (
              <p className="text-sm text-on-surface-variant">No pending photos.</p>
            )}
            {data.galleryQueue.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{g.caption || g.url}</p>
                </div>
                <form action={actionApproveGallery}>
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="approve" value="true" />
                  <button className="px-3 py-1.5 rounded-lg bg-secondary-container text-sm">
                    Publish
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3">Roles</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {data.allUsers.map((u) => (
                <tr key={u.id} className="border-t border-outline-variant/30">
                  <td className="py-2">{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.status}</td>
                  <td>
                    <form
                      action={async (fd) => {
                        'use server'
                        await setMemberRole({
                          userId: u.id,
                          role: String(fd.get('role')) as
                            | 'ADMIN'
                            | 'EXECUTIVE'
                            | 'TREASURER'
                            | 'SECRETARY'
                            | 'ORGANIZER'
                            | 'MEMBER',
                        })
                      }}
                      className="flex gap-2 items-center"
                    >
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="border rounded px-2 py-1 bg-surface"
                      >
                        {['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'].map(
                          (r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          )
                        )}
                      </select>
                      <button className="text-primary text-xs font-semibold">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface p-4">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          <ul className="space-y-2 text-sm">
            {data.recentAudit.map((a) => (
              <li key={a.id} className="border-b border-outline-variant/20 pb-2">
                <span className="font-medium">{a.action}</span>
                <span className="text-on-surface-variant">
                  {' '}
                  by {a.user.fullName} · {a.createdAt.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="rounded-xl border border-outline-variant/40 bg-surface p-4">
          <h2 className="font-semibold mb-3">Open welfare requests</h2>
          <p className="text-2xl font-semibold">{data.openWelfare}</p>
          <MemberGrowthChart
            labels={['Active', 'Pending']}
            values={[data.activeMembers, data.pendingMembers]}
          />
        </div>
      </div>
    </DashboardShell>
  )
}
