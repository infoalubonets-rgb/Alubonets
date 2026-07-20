import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { MEMBER_NAV } from '@/lib/dashboard/nav'
import { actionCreateWelfare } from '@/app/actions/domain'
import { getSessionProfile } from '@/lib/auth/session'
import { createClient } from '@/utils/supabase/server'

export default async function MemberWelfarePage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: welfare } = await supabase
    .from('welfare_requests')
    .select('id, status, description')
    .eq('userId', profile.id)
    .order('createdAt', { ascending: false })

  return (
    <DashboardShell role="MEMBER" title="Welfare" nav={MEMBER_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Request welfare support</h2>
          <form action={actionCreateWelfare} className="grid gap-3">
            <textarea
              name="description"
              required
              placeholder="Describe your need"
              className="border rounded-lg px-3 py-2"
            />
            <input
              name="amount"
              type="number"
              placeholder="Amount (optional)"
              className="border rounded-lg px-3 py-2"
            />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2">Submit request</button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Your requests</h2>
          <ul className="space-y-2 text-sm">
            {(welfare ?? []).length === 0 ? (
              <li className="text-on-surface-variant">No welfare requests yet.</li>
            ) : (
              (welfare ?? []).map((w) => (
                <li key={w.id} className="border-b pb-2">
                  {w.status}: {w.description}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </DashboardShell>
  )
}
