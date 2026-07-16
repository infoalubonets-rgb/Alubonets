import DashboardShell, { type NavItem } from '@/components/dashboard/DashboardShell'
import { actionCreateWelfare } from '@/app/actions/domain'
import { getMemberDashboardData } from '@/lib/data/queries'
import { getSessionProfile } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

const NAV: NavItem[] = [
  { icon: 'home', label: 'Home', active: true },
  { icon: 'payments', label: 'Contributions' },
  { icon: 'volunteer_activism', label: 'Welfare' },
]

export default async function MemberPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  const data = await getMemberDashboardData(profile.id)

  return (
    <DashboardShell role="MEMBER" title="Member" nav={NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-surface p-4">
            <p className="text-xs text-on-surface-variant uppercase">My contributions</p>
            <p className="text-2xl font-semibold mt-1">
              KES {Math.round(data.total).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border bg-surface p-4">
            <p className="text-xs text-on-surface-variant uppercase">Welfare requests</p>
            <p className="text-2xl font-semibold mt-1">{data.welfare.length}</p>
          </div>
        </div>

        <section className="rounded-xl border bg-surface p-4 overflow-x-auto">
          <div className="flex justify-between mb-3">
            <h2 className="font-semibold">Contribution history</h2>
            <a href={`/api/pdf/statement/${profile.id}`} className="text-sm text-primary underline">
              Statement PDF
            </a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">Date</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {data.contributions.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{c.paidAt.toLocaleDateString()}</td>
                  <td>{c.amount.toLocaleString()}</td>
                  <td>{c.category || '—'}</td>
                  <td>
                    <a href={`/api/pdf/receipt/${c.id}`} className="text-primary underline">
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Request welfare support</h2>
          <form action={actionCreateWelfare} className="grid gap-3">
            <textarea name="description" required placeholder="Describe your need" className="border rounded-lg px-3 py-2" />
            <input name="amount" type="number" placeholder="Amount (optional)" className="border rounded-lg px-3 py-2" />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2">Submit request</button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {data.welfare.map((w) => (
              <li key={w.id} className="border-b pb-2">
                {w.status}: {w.description}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Announcements</h2>
          <ul className="space-y-2">
            {data.announcements.map((a) => (
              <li key={a.id} className="border-b pb-2">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-on-surface-variant">{a.content}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Upcoming events</h2>
          <ul className="space-y-2 text-sm">
            {data.events.map((e) => (
              <li key={e.id}>
                {e.title} — {e.startsAt.toLocaleString()}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Documents</h2>
          <ul className="space-y-2 text-sm">
            {data.documents.map((d) => (
              <li key={d.id}>
                <a href={d.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardShell>
  )
}
