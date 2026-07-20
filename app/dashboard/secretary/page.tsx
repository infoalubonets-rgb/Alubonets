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
  const recentMeetings = data.meetings.slice(0, 3)

  const stats = [
    { label: 'Documents',      value: data.documents.length,     icon: 'description', color: 'bg-primary dark:bg-[#0c1e42]',                                               text: 'text-on-primary',                     iconBg: 'bg-white/15' },
    { label: 'Meetings',       value: data.meetings.length,      icon: 'groups',      color: 'bg-secondary dark:bg-[#c45e00]',                                             text: 'text-white',                          iconBg: 'bg-white/15' },
    { label: 'Avg attendance', value: data.attendanceAvg,        icon: 'how_to_reg',  color: 'bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30', text: 'text-primary dark:text-blue-200', iconBg: 'bg-primary/15 dark:bg-primary/25' },
    { label: 'Announcements',  value: data.announcements.length, icon: 'campaign',    color: 'bg-secondary/10 dark:bg-[#c45e00]/15 border border-secondary/25',             text: 'text-secondary dark:text-orange-300', iconBg: 'bg-secondary/15' },
  ]

  const quickLinks = [
    { label: 'Announcements', description: 'Publish and review notices', icon: 'campaign', href: '/announcements' },
    { label: 'Meetings', description: 'Minutes, attendance, DOCX export', icon: 'groups', href: '/dashboard/secretary/meetings' },
    { label: 'Contributions', description: 'View contribution records', icon: 'payments', href: '/contributions' },
  ]

  return (
    <DashboardShell role="SECRETARY" title="Secretary" nav={SECRETARY_NAV}>
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

        {/* Next meeting spotlight */}
        {nextMeeting && (
          <div className="flex items-center gap-4 rounded-2xl border border-primary/20 dark:border-[#1a2d4f] bg-primary/5 dark:bg-[#0c1e42]/60 px-5 py-4">
            <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-primary/20 dark:border-[#1e3461] bg-surface dark:bg-[#0d1729] py-1.5 text-center">
              <span className="text-[10px] font-semibold text-secondary dark:text-orange-300 uppercase leading-none">
                {new Date(nextMeeting.heldAt).toLocaleDateString(undefined, { month: 'short' })}
              </span>
              <span className="text-[18px] font-bold text-primary dark:text-blue-50 leading-tight">
                {new Date(nextMeeting.heldAt).getDate()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-primary/60 dark:text-blue-200/50 uppercase tracking-wider mb-0.5">Next meeting</p>
              <p className="font-semibold text-[14px] text-primary dark:text-blue-50 truncate">{nextMeeting.title}</p>
              <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                {new Date(nextMeeting.heldAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}{nextMeeting.attendance} attending
              </p>
            </div>
            <Link
              href="/dashboard/secretary/meetings"
              className="shrink-0 flex items-center gap-1 rounded-lg bg-primary text-on-primary px-3 py-1.5 text-[12px] font-semibold hover:opacity-90 transition-opacity"
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
              className="group flex items-center gap-3 rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 20 }}>
                  {l.icon}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[13px] text-on-surface dark:text-blue-50">{l.label}</p>
                <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">{l.description}</p>
              </div>
              <span className="material-symbols-outlined text-outline dark:text-blue-200/30 group-hover:text-primary group-hover:translate-x-0.5 ml-auto shrink-0 transition-all" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Two-column: recent meetings + recent documents */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Recent meetings */}
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>groups</span>
                <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Meetings</h2>
              </div>
              <Link href="/dashboard/secretary/meetings" className="text-[12px] text-primary dark:text-blue-300 hover:underline font-medium">
                View all →
              </Link>
            </div>
            {recentMeetings.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No meetings recorded.</p>
            ) : (
              <ul className="divide-y divide-outline-variant dark:divide-[#1a2d4f]">
                {recentMeetings.map((m) => (
                  <li key={m.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-[13px] font-medium text-on-surface dark:text-blue-50 truncate">{m.title}</p>
                    <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                      {new Date(m.heldAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{m.attendance} attending
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent documents */}
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>folder_open</span>
              <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Documents</h2>
            </div>
            {data.documents.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No documents yet.</p>
            ) : (
              <ul className="space-y-1">
                {data.documents.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
                    >
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40 group-hover:text-primary transition-colors" style={{ fontSize: 15 }}>
                        description
                      </span>
                      <span className="text-[12px] text-on-surface dark:text-blue-200 group-hover:underline truncate flex-1">
                        {d.title}
                      </span>
                      <span className="text-[10px] text-outline dark:text-blue-200/30 shrink-0">
                        {d.category || 'General'}
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
