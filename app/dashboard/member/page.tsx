import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { MEMBER_NAV } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { createClient } from '@/utils/supabase/server'
import MemberContributeModal from '@/components/dashboard/MemberContributeModal'

export default async function MemberPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const now = new Date().toISOString()

  const [
    { data: contributions },
    { data: announcements },
    { data: events },
    { data: documents },
    { data: welfare },
  ] = await Promise.all([
    supabase.from('contributions').select('amount').eq('userId', profile.id),
    supabase
      .from('announcements')
      .select('id, title, content, publishedAt')
      .eq('broadcast', true)
      .order('publishedAt', { ascending: false })
      .limit(5),
    supabase
      .from('events')
      .select('id, title, startsAt')
      .gte('startsAt', now)
      .order('startsAt', { ascending: true })
      .limit(5),
    supabase
      .from('documents')
      .select('id, title, fileUrl')
      .order('uploadedAt', { ascending: false })
      .limit(5),
    supabase.from('welfare_requests').select('id').eq('userId', profile.id),
  ])

  const total = (contributions ?? []).reduce((s, c) => s + (c.amount ?? 0), 0)
  const welfareCount = welfare?.length ?? 0

  return (
    <DashboardShell role="MEMBER" title="Member" nav={MEMBER_NAV}>
      <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-primary dark:bg-[#0c1e42] p-5 shadow-sm">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/[0.07]" />
            <div className="absolute -right-1 top-6 h-14 w-14 rounded-full bg-white/[0.05]" />
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <span className="material-symbols-outlined icon-fill text-on-primary" style={{ fontSize: 20 }}>
                  account_balance_wallet
                </span>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-on-primary/70 uppercase tracking-wider">
                Total
              </span>
            </div>
            <p className="mt-4 text-[26px] font-bold text-on-primary leading-none tracking-tight">
              KES {Math.round(total).toLocaleString()}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-on-primary/60 uppercase tracking-wider">
              My contributions
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-secondary-container dark:bg-[#1e3461] p-5 shadow-sm">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-black/[0.05] dark:bg-white/[0.04]" />
            <div className="absolute -right-1 top-6 h-14 w-14 rounded-full bg-black/[0.04] dark:bg-white/[0.03]" />
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 dark:bg-white/10">
                <span className="material-symbols-outlined icon-fill text-primary dark:text-blue-200" style={{ fontSize: 20 }}>
                  volunteer_activism
                </span>
              </div>
              <span className="rounded-full bg-primary/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-primary dark:text-blue-200 uppercase tracking-wider">
                Active
              </span>
            </div>
            <p className="mt-4 text-[26px] font-bold text-primary dark:text-blue-50 leading-none tracking-tight">
              {welfareCount}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
              Welfare requests
            </p>
          </div>
        </div>

        {/* Contribute CTA */}
        <div className="flex justify-end">
          <MemberContributeModal />
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/member/contributions"
            className="group flex items-center gap-4 rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 22 }}>
                payments
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-on-surface dark:text-blue-50 text-[14px]">Contributions</p>
              <p className="text-[12px] text-on-surface-variant dark:text-blue-200/60 mt-0.5 truncate">
                History and statement PDF
              </p>
            </div>
            <span className="material-symbols-outlined text-outline dark:text-blue-200/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" style={{ fontSize: 18 }}>
              chevron_right
            </span>
          </Link>

          <Link
            href="/dashboard/member/welfare"
            className="group flex items-center gap-4 rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 hover:border-secondary/50 hover:shadow-md transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-container/60 dark:bg-secondary/20 group-hover:bg-secondary-container transition-colors">
              <span className="material-symbols-outlined icon-fill text-secondary dark:text-orange-300" style={{ fontSize: 22 }}>
                volunteer_activism
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-on-surface dark:text-blue-50 text-[14px]">Welfare</p>
              <p className="text-[12px] text-on-surface-variant dark:text-blue-200/60 mt-0.5 truncate">
                Request support and track status
              </p>
            </div>
            <span className="material-symbols-outlined text-outline dark:text-blue-200/30 group-hover:text-secondary group-hover:translate-x-0.5 transition-all" style={{ fontSize: 18 }}>
              chevron_right
            </span>
          </Link>
        </div>

        {/* Announcements + Events */}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>campaign</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">
                Announcements
              </h2>
            </div>
            {(announcements ?? []).length === 0 ? (
              <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No announcements yet.</p>
            ) : (
              <ul className="space-y-3">
                {(announcements ?? []).map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60 dark:bg-blue-400/60" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 leading-snug">{a.title}</p>
                      <p className="text-[12px] text-on-surface-variant dark:text-blue-200/60 mt-0.5 line-clamp-2">{a.content}</p>
                      {a.publishedAt && (
                        <p className="text-[10px] text-outline dark:text-blue-200/30 mt-1 uppercase tracking-wide">
                          {new Date(a.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>event</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">
                Upcoming events
              </h2>
            </div>
            {(events ?? []).length === 0 ? (
              <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No upcoming events.</p>
            ) : (
              <ul className="space-y-2.5">
                {(events ?? []).map((e) => {
                  const d = new Date(e.startsAt)
                  return (
                    <li key={e.id} className="flex items-start gap-3">
                      <div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] py-1 text-center">
                        <span className="text-[10px] font-semibold text-secondary dark:text-orange-300 uppercase leading-none">
                          {d.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="text-[15px] font-bold text-primary dark:text-blue-50 leading-tight">
                          {d.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-on-surface dark:text-blue-50 leading-snug truncate">{e.title}</p>
                        <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                          {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Documents */}
        {(documents ?? []).length > 0 && (
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>folder_open</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Documents</h2>
            </div>
            <ul className="space-y-1.5">
              {(documents ?? []).map((d) => (
                <li key={d.id}>
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
                  >
                    <span className="material-symbols-outlined text-outline dark:text-blue-200/40 group-hover:text-primary transition-colors" style={{ fontSize: 16 }}>
                      description
                    </span>
                    <span className="text-[13px] text-primary dark:text-blue-300 group-hover:underline truncate">{d.title}</span>
                    <span className="material-symbols-outlined text-outline dark:text-blue-200/30 ml-auto shrink-0" style={{ fontSize: 14 }}>
                      open_in_new
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
