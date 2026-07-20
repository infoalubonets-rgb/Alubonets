import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ORGANIZER_NAV } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { actionCreateEvent } from '@/app/actions/domain'

export default async function OrganizerEventsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const now = new Date().toISOString()

  const { data: allEvents } = await supabase
    .from('events')
    .select('id, title, startsAt, location, description')
    .order('startsAt', { ascending: true })

  const events = allEvents ?? []
  const upcoming = events.filter((e) => e.startsAt >= now)
  const past = events.filter((e) => e.startsAt < now).reverse()

  return (
    <DashboardShell role="ORGANIZER" title="Events" nav={ORGANIZER_NAV}>
      <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">

        {/* Create event form */}
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>add_circle</span>
            </div>
            <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Create event</h2>
          </div>
          <form action={actionCreateEvent} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                Title <span className="text-secondary">*</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <input name="title" placeholder="e.g. Quarterly General Meeting" required className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                Date &amp; time <span className="text-secondary">*</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 15 }}>schedule</span>
                <input name="startsAt" type="datetime-local" required className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Location</label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 15 }}>location_on</span>
                <input name="location" placeholder="e.g. Community Hall" className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Description</label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <input name="description" placeholder="Short description" className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30" />
              </div>
            </div>
            <button type="submit" className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Save event
            </button>
          </form>
        </section>

        {/* Upcoming */}
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>event_upcoming</span>
            <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">
              Upcoming ({upcoming.length})
            </h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No upcoming events.</p>
          ) : (
            <ul className="divide-y divide-outline-variant dark:divide-[#1a2d4f]">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] py-1.5 text-center">
                    <span className="text-[10px] font-semibold text-secondary dark:text-orange-300 uppercase leading-none">
                      {new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-[17px] font-bold text-primary dark:text-blue-50 leading-tight">
                      {new Date(e.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 leading-snug">{e.title}</p>
                    <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                      {new Date(e.startsAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                    {e.description && (
                      <p className="text-[12px] text-on-surface-variant dark:text-blue-200/40 mt-1 line-clamp-1">{e.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 18 }}>history</span>
              <h2 className="font-semibold text-[13px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                Past ({past.length})
              </h2>
            </div>
            <ul className="divide-y divide-outline-variant dark:divide-[#1a2d4f]">
              {past.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 opacity-60">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] py-1.5 text-center">
                    <span className="text-[10px] font-semibold text-on-surface-variant uppercase leading-none">
                      {new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-[17px] font-bold text-on-surface dark:text-blue-200 leading-tight">
                      {new Date(e.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-on-surface dark:text-blue-200 line-through decoration-outline">{e.title}</p>
                    <p className="text-[12px] text-on-surface-variant dark:text-blue-200/40 mt-0.5">
                      {new Date(e.startsAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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
