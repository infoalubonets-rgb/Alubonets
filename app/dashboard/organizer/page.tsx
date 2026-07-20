import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ORGANIZER_NAV } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import Link from 'next/link'

export default async function OrganizerPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const now = new Date().toISOString()

  const [
    { data: allEvents },
    { data: gallery },
    { data: projects },
  ] = await Promise.all([
    supabase.from('events').select('id, title, startsAt, location, description').order('startsAt', { ascending: true }),
    supabase.from('gallery_photos').select('id').order('uploadedAt', { ascending: false }),
    supabase.from('projects').select('id').order('updatedAt', { ascending: false }),
  ])

  const events = allEvents ?? []
  const upcoming = events.filter((e) => e.startsAt >= now)
  const nextEvent = upcoming[0] ?? null

  const stats = [
    { label: 'Total events',   value: events.length,           icon: 'event',         color: 'bg-primary dark:bg-[#0c1e42]',                                               text: 'text-on-primary',                         iconBg: 'bg-white/15' },
    { label: 'Upcoming',       value: upcoming.length,          icon: 'event_upcoming', color: 'bg-secondary dark:bg-[#c45e00]',                                             text: 'text-white',                              iconBg: 'bg-white/15' },
    { label: 'Gallery photos', value: (gallery ?? []).length,   icon: 'photo_library', color: 'bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30', text: 'text-primary dark:text-blue-200',      iconBg: 'bg-primary/15 dark:bg-primary/25' },
    { label: 'Projects',       value: (projects ?? []).length,  icon: 'work',          color: 'bg-secondary/10 dark:bg-[#c45e00]/15 border border-secondary/25',             text: 'text-secondary dark:text-orange-300',     iconBg: 'bg-secondary/15' },
  ]

  const quickLinks = [
    { label: 'Events', description: 'Create and manage events', icon: 'event', href: '/dashboard/organizer/events' },
    { label: 'Gallery', description: 'Upload and review photos', icon: 'photo_library', href: '/dashboard/organizer/gallery' },
    { label: 'Projects', description: 'Create and update projects', icon: 'work', href: '/dashboard/organizer/projects' },
  ]

  return (
    <DashboardShell role="ORGANIZER" title="Organizer" nav={ORGANIZER_NAV}>
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
              <p className={`mt-3 text-[24px] font-bold leading-none tracking-tight ${s.text}`}>{s.value}</p>
              <p className={`mt-1 text-[11px] font-medium uppercase tracking-wider ${s.text} opacity-60`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Next event spotlight */}
        {nextEvent && (
          <div className="flex items-center gap-4 rounded-2xl border border-primary/20 dark:border-[#1a2d4f] bg-primary/5 dark:bg-[#0c1e42]/60 px-5 py-4">
            <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-primary/20 dark:border-[#1e3461] bg-surface dark:bg-[#0d1729] py-1.5 text-center">
              <span className="text-[10px] font-semibold text-secondary dark:text-orange-300 uppercase leading-none">
                {new Date(nextEvent.startsAt).toLocaleDateString(undefined, { month: 'short' })}
              </span>
              <span className="text-[18px] font-bold text-primary dark:text-blue-50 leading-tight">
                {new Date(nextEvent.startsAt).getDate()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-primary/60 dark:text-blue-200/50 uppercase tracking-wider mb-0.5">Next event</p>
              <p className="font-semibold text-[14px] text-primary dark:text-blue-50 truncate">{nextEvent.title}</p>
              <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                {new Date(nextEvent.startsAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {nextEvent.location ? ` · ${nextEvent.location}` : ''}
              </p>
            </div>
            <Link
              href="/dashboard/organizer/events"
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

        {/* Upcoming events preview */}
        {upcoming.length > 1 && (
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>event</span>
                <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">Upcoming events</h2>
              </div>
              <Link href="/dashboard/organizer/events" className="text-[12px] text-primary dark:text-blue-300 hover:underline font-medium">
                Manage →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {upcoming.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] py-1 text-center">
                    <span className="text-[10px] font-semibold text-secondary dark:text-orange-300 uppercase leading-none">
                      {new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-[15px] font-bold text-primary dark:text-blue-50 leading-tight">
                      {new Date(e.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-on-surface dark:text-blue-50 truncate">{e.title}</p>
                    <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                      {new Date(e.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
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
