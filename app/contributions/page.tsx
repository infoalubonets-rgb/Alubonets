import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/auth/types'

export const metadata = {
  title: 'My contributions',
}

export default async function ContributionsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/contributions')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: contributions } = await supabase
    .from('contributions')
    .select('id, amount, paidAt, category')
    .eq('userId', profile.id)
    .order('paidAt', { ascending: false })

  const total = (contributions ?? []).reduce((s, c) => s + (c.amount ?? 0), 0)

  return (
    <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
      <div className="max-w-3xl mx-auto space-y-4 pb-10">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-wrap items-end justify-between gap-3 border-t-4 border-t-secondary-container">
          <div>
            <p className="text-[12px] font-label-bold uppercase tracking-wide text-secondary">
              Your total
            </p>
            <p className="mt-1 text-3xl font-h3 font-bold text-primary">
              KES {Math.round(total).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Every role contributes — you are part of the team.
            </p>
          </div>
          <a
            href={`/api/pdf/statement/${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container text-on-primary px-4 py-2.5 text-sm font-label-bold shadow-sm hover:opacity-95"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Statement PDF
          </a>
        </div>

        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low">
            <h2 className="font-label-bold text-sm text-on-surface">Contribution history</h2>
          </div>
          {(contributions ?? []).length === 0 ? (
            <p className="px-4 py-8 text-sm text-on-surface-variant text-center">
              No contributions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-on-surface-variant border-b border-outline-variant/60">
                    <th className="py-3 px-4 font-label-bold">Date</th>
                    <th className="py-3 px-4 font-label-bold">Amount</th>
                    <th className="py-3 px-4 font-label-bold">Category</th>
                    <th className="py-3 px-4 font-label-bold">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {(contributions ?? []).map((c, i) => (
                    <tr
                      key={c.id}
                      className={`border-t border-outline-variant/40 ${
                        i % 2 === 1 ? 'bg-surface-container-low/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4">{new Date(c.paidAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-label-bold text-secondary">
                        KES {c.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">{c.category || '—'}</td>
                      <td className="py-3 px-4">
                        <a
                          href={`/api/pdf/receipt/${c.id}`}
                          className="text-secondary-container font-label-bold underline"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
