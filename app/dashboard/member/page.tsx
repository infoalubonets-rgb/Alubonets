import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { MEMBER_NAV } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { createClient } from '@/utils/supabase/server'
import AnnouncementsRealtime from '@/components/dashboard/AnnouncementsRealtime'
import MemberStatsRealtime from '@/components/dashboard/MemberStatsRealtime'

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

  return (
    <DashboardShell role="MEMBER" title="Member" nav={MEMBER_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <MemberStatsRealtime
          userId={profile.id}
          initialTotal={total}
          initialWelfareCount={welfare?.length ?? 0}
        />

        <div className="grid md:grid-cols-2 gap-3">
          <Link href="/dashboard/member/contributions" className="rounded-xl border bg-surface p-4">
            <p className="font-semibold">Contributions</p>
            <p className="text-sm text-on-surface-variant mt-1">History and statement PDF</p>
          </Link>
          <Link href="/dashboard/member/welfare" className="rounded-xl border bg-surface p-4">
            <p className="font-semibold">Welfare</p>
            <p className="text-sm text-on-surface-variant mt-1">Request support and track status</p>
          </Link>
        </div>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Announcements</h2>
          <AnnouncementsRealtime initial={announcements ?? []} />
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Upcoming events</h2>
          <ul className="space-y-2 text-sm">
            {(events ?? []).length === 0 ? (
              <li className="text-on-surface-variant">No upcoming events.</li>
            ) : (
              (events ?? []).map((e) => (
                <li key={e.id}>
                  {e.title} — {new Date(e.startsAt).toLocaleString()}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Documents</h2>
          <ul className="space-y-2 text-sm">
            {(documents ?? []).length === 0 ? (
              <li className="text-on-surface-variant">No documents available.</li>
            ) : (
              (documents ?? []).map((d) => (
                <li key={d.id}>
                  <a href={d.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                    {d.title}
                  </a>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </DashboardShell>
  )
}
