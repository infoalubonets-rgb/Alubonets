import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import { getSecretaryDashboardData } from '@/lib/data/queries'
import Link from 'next/link'

export default async function SecretaryPage() {
  const data = await getSecretaryDashboardData()

  const now = new Date()
  const nextMeeting = [...data.meetings]
    .filter((m) => new Date(m.heldAt) >= now)
    .sort((a, b) => new Date(a.heldAt).getTime() - new Date(b.heldAt).getTime())[0] ?? null
  const recentMeetings = data.meetings.slice(0, 4)

  const stats = [
    { label: 'Documents',     value: data.documents.length,     icon: 'description',   from: 'from-[#001f50]', to: 'to-[#0a3070]' },
    { label: 'Meetings',      value: data.meetings.length,      icon: 'groups',         from: 'from-[#fe8015]', to: 'to-[#ff9c40]' },
    { label: 'Avg attendance',value: data.attendanceAvg,        icon: 'how_to_reg',     from: 'from-[#001f50]', to: 'to-[#153060]' },
    { label: 'Announcements', value: data.announcements.length, icon: 'campaign',       from: 'from-[#fe8015]', to: 'to-[#c45e00]' },
  ]

  const quickLinks = [
    { label: 'Announcements',  description: 'Publish and review notices',     icon: 'campaign',  href: '/announcements',                    orange: false },
    { label: 'Meetings',       description: 'Minutes, attendance, exports',   icon: 'groups',    href: '/dashboard/secretary/meetings',      orange: true  },
    { label: 'Contributions',  description: 'View contribution records',      icon: 'payments',  href: '/contributions',                    orange: false },
  ]

  return (
    <DashboardShell role="SECRETARY" title="Secretary" nav={SECRETARY_NAV}>
      <div className="space-y-5 max-w-5xl mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.from} ${s.to} p-4 shadow-sm`}
            >
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/[0.06]" />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: 18 }}>
                  {s.icon}
                </span>
              </div>
              <p className="mt-3 text-[24px] font-bold leading-none tracking-tight text-white">{s.value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Next meeting spotlight */}
        {nextMeeting && (
          <div className="flex items-center gap-4 rounded-2xl border border-[#fe8015]/25 bg-gradient-to-r from-[#fe8015]/8 to-transparent px-5 py-4">
            <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-[#fe8015]/30 bg-white/80 dark:bg-[#0d1729] py-2 text-center">
              <span className="text-[10px] font-bold text-[#fe8015] uppercase leading-none tracking-wide">
                {new Date(nextMeeting.heldAt).toLocaleDateString('en-KE', { month: 'short' })}
              </span>
              <span className="text-[22px] font-bold text-[#001f50] dark:text-blue-100 leading-tight">
                {new Date(nextMeeting.heldAt).getDate()}
              </span>
              <span className="text-[10px] text-[#fe8015]/60 leading-none">
                {new Date(nextMeeting.heldAt).getFullYear()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#fe8015] uppercase tracking-widest mb-0.5">Next meeting</p>
              <p className="font-bold text-[14px] text-[#001f50] dark:text-blue-50 truncate">{nextMeeting.title}</p>
              <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                {new Date(nextMeeting.heldAt).toLocaleString('en-KE', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
                {' · '}{nextMeeting.attendance} attending
              </p>
            </div>
            <Link
              href="/dashboard/secretary/meetings"
              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[#fe8015] text-white px-3.5 py-2 text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              View all
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
            </Link>
          </div>
        )}

        {/* Quick links */}
        <div className="grid sm:grid-cols-3 gap-3">
          {quickLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={`group flex items-center gap-3 rounded-2xl border p-4 hover:shadow-md transition-all ${
                l.orange
                  ? 'border-[#fe8015]/25 bg-gradient-to-br from-[#fe8015]/5 to-transparent hover:border-[#fe8015]/40'
                  : 'border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] hover:border-primary/30'
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                l.orange
                  ? 'bg-[#fe8015]/15 group-hover:bg-[#fe8015]/25'
                  : 'bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20'
              }`}>
                <span className={`material-symbols-outlined icon-fill ${l.orange ? 'text-[#fe8015]' : 'text-primary'}`} style={{ fontSize: 20 }}>
                  {l.icon}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[13px] text-on-surface dark:text-blue-50">{l.label}</p>
                <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">{l.description}</p>
              </div>
              <span className={`material-symbols-outlined ml-auto shrink-0 group-hover:translate-x-0.5 transition-all ${
                l.orange ? 'text-[#fe8015]/40 group-hover:text-[#fe8015]' : 'text-outline dark:text-blue-200/30 group-hover:text-primary'
              }`} style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Recent meetings + Documents */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Recent meetings */}
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60 dark:border-[#1a2d4f] bg-[#001f50]/4 dark:bg-[#001f50]/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-fill text-[#001f50] dark:text-blue-300" style={{ fontSize: 17 }}>groups</span>
                <h2 className="font-bold text-[12px] text-[#001f50] dark:text-blue-200 uppercase tracking-widest">Recent Meetings</h2>
              </div>
              <Link href="/dashboard/secretary/meetings" className="text-[11px] text-[#fe8015] font-semibold hover:opacity-80 transition-opacity">
                View all →
              </Link>
            </div>
            {recentMeetings.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-[32px] text-outline/40">groups</span>
                <p className="text-[13px] text-on-surface-variant mt-2">No meetings recorded yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/40 dark:divide-[#1a2d4f]">
                {recentMeetings.map((m) => {
                  const isFinal = m.status === 'FINAL'
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/dashboard/secretary/meetings/${m.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container/50 dark:hover:bg-[#111f36]/60 transition-colors group"
                      >
                        {/* Date badge */}
                        <div className={`flex-shrink-0 w-10 rounded-lg text-center py-1.5 border ${
                          isFinal
                            ? 'bg-[#001f50]/8 dark:bg-[#001f50]/30 border-blue-200 dark:border-[#1a2d4f]'
                            : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200/70 dark:border-orange-900/40'
                        }`}>
                          <p className={`text-[9px] font-bold leading-none uppercase ${isFinal ? 'text-[#001f50] dark:text-blue-300' : 'text-[#fe8015]'}`}>
                            {new Date(m.heldAt).toLocaleDateString('en-KE', { month: 'short' })}
                          </p>
                          <p className={`text-[15px] font-bold leading-tight ${isFinal ? 'text-[#001f50] dark:text-blue-200' : 'text-[#fe8015]'}`}>
                            {new Date(m.heldAt).getDate()}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 truncate group-hover:text-primary transition-colors">
                            {m.title}
                          </p>
                          <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                            {m.attendance} present
                          </p>
                        </div>
                        {isFinal ? (
                          <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-[#001f50]/10 dark:bg-[#001f50]/40 text-[#001f50] dark:text-blue-300">
                            <span className="material-symbols-outlined icon-fill" style={{ fontSize: 10 }}>verified</span>
                            Final
                          </span>
                        ) : (
                          <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-orange-100 dark:bg-orange-950/50 text-[#fe8015]">
                            Draft
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Documents */}
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60 dark:border-[#1a2d4f] bg-[#fe8015]/6 dark:bg-[#fe8015]/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-fill text-[#fe8015]" style={{ fontSize: 17 }}>folder_open</span>
                <h2 className="font-bold text-[12px] text-[#fe8015] uppercase tracking-widest">Documents</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#fe8015]/15 text-[#fe8015] text-[10px] font-bold">
                {data.documents.length}
              </span>
            </div>
            {data.documents.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-[32px] text-outline/40">description</span>
                <p className="text-[13px] text-on-surface-variant mt-2">No documents yet. Publish a meeting to create one.</p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/40 dark:divide-[#1a2d4f]">
                {data.documents.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container/50 dark:hover:bg-[#111f36]/60 transition-colors group"
                    >
                      {/* Icon badge */}
                      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#fe8015]/10 border border-[#fe8015]/20 dark:border-[#fe8015]/30 flex items-center justify-center">
                        <span className="material-symbols-outlined icon-fill text-[#fe8015]" style={{ fontSize: 17 }}>description</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 truncate group-hover:text-[#fe8015] transition-colors">
                          {d.title}
                        </p>
                        <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                          {d.uploader?.fullName ?? 'Unknown'}
                          {' · '}
                          {new Date(d.uploadedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {d.category && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#001f50]/8 dark:bg-[#001f50]/30 text-[#001f50] dark:text-blue-300">
                          {d.category}
                        </span>
                      )}
                      <span className="material-symbols-outlined text-outline/40 dark:text-blue-200/20 group-hover:text-[#fe8015] transition-colors flex-shrink-0" style={{ fontSize: 15 }}>
                        open_in_new
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>
    </DashboardShell>
  )
}
