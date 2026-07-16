import DashboardShell, { type NavItem } from '@/components/dashboard/DashboardShell'
import { getExecutiveDashboardData, getContributionChartSeries } from '@/lib/data/queries'
import { ContributionTrendChart } from '@/components/dashboard/Charts'
import { actionUpsertProject } from '@/app/actions/domain'

const NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', active: true },
  { icon: 'work', label: 'Projects' },
  { icon: 'campaign', label: 'Announcements' },
]

export default async function ExecutivePage() {
  const data = await getExecutiveDashboardData()
  const chart = await getContributionChartSeries()

  return (
    <DashboardShell role="EXECUTIVE" title="Executive Committee" nav={NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Active members', value: data.members },
            {
              label: 'Contributions (KES)',
              value: Math.round(data.totalContributions).toLocaleString(),
            },
            { label: 'Projects', value: data.projects.length },
            { label: 'Upcoming events', value: data.upcomingEvents },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-surface p-4">
              <p className="text-xs text-on-surface-variant uppercase">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Contribution trend</h2>
          <ContributionTrendChart
            labels={chart.labels.length ? chart.labels : ['—']}
            values={chart.values.length ? chart.values : [0]}
          />
        </div>

        <section className="rounded-xl border bg-surface p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3">Projects</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">Title</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-on-surface-variant text-xs line-clamp-1">{p.description}</p>
                  </td>
                  <td>{p.status}</td>
                  <td>{p.updatedAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Add / update project</h2>
          <form action={actionUpsertProject} className="grid gap-3 md:grid-cols-2">
            <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
            <select name="status" className="border rounded-lg px-3 py-2">
              <option value="UPCOMING">UPCOMING</option>
              <option value="ONGOING">ONGOING</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <textarea
              name="description"
              placeholder="Description"
              required
              className="border rounded-lg px-3 py-2 md:col-span-2"
              rows={3}
            />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2 md:col-span-2">
              Save project
            </button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Latest announcements</h2>
          <ul className="space-y-2">
            {data.announcements.map((a) => (
              <li key={a.id} className="border-b pb-2">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-on-surface-variant">{a.content}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardShell>
  )
}
