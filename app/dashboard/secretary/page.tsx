import DashboardShell, { type NavItem } from '@/components/dashboard/DashboardShell'
import {
  actionCreateAnnouncement,
  actionCreateDocument,
  actionCreateMeeting,
} from '@/app/actions/domain'
import { getSecretaryDashboardData } from '@/lib/data/queries'

const NAV: NavItem[] = [
  { icon: 'description', label: 'Records', active: true },
  { icon: 'campaign', label: 'Announcements' },
  { icon: 'groups', label: 'Meetings' },
]

export default async function SecretaryPage() {
  const data = await getSecretaryDashboardData()

  return (
    <DashboardShell role="SECRETARY" title="Secretary" nav={NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Documents', value: data.documents.length },
            { label: 'Meetings', value: data.meetings.length },
            { label: 'Avg attendance', value: data.attendanceAvg },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-surface p-4">
              <p className="text-xs text-on-surface-variant uppercase">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">New announcement</h2>
          <form action={actionCreateAnnouncement} className="grid gap-3">
            <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
            <textarea name="content" placeholder="Content" required rows={3} className="border rounded-lg px-3 py-2" />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2">Publish</button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Record meeting</h2>
          <form action={actionCreateMeeting} className="grid gap-3 md:grid-cols-2">
            <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
            <input name="heldAt" type="datetime-local" required className="border rounded-lg px-3 py-2" />
            <input name="attendance" type="number" placeholder="Attendance" className="border rounded-lg px-3 py-2" />
            <textarea name="agenda" placeholder="Agenda" className="border rounded-lg px-3 py-2 md:col-span-2" />
            <textarea name="minutes" placeholder="Minutes" className="border rounded-lg px-3 py-2 md:col-span-2" />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2 md:col-span-2">Save meeting</button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Add document (URL)</h2>
          <form action={actionCreateDocument} className="grid gap-3 md:grid-cols-2">
            <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
            <input name="category" placeholder="Category" className="border rounded-lg px-3 py-2" />
            <input name="fileUrl" placeholder="https://..." required className="border rounded-lg px-3 py-2 md:col-span-2" />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2 md:col-span-2">Save document</button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Meetings</h2>
            <a href="/api/export/meetings" className="text-sm text-primary underline">
              Export DOCX
            </a>
          </div>
          <ul className="space-y-2 text-sm">
            {data.meetings.map((m) => (
              <li key={m.id} className="border-b pb-2">
                <p className="font-medium">
                  {m.title} · {m.heldAt.toLocaleDateString()} · {m.attendance} present
                </p>
                {m.minutes && <p className="text-on-surface-variant">{m.minutes}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Documents</h2>
          <ul className="space-y-2 text-sm">
            {data.documents.map((d) => (
              <li key={d.id} className="flex justify-between gap-2 border-b pb-2">
                <span>
                  {d.title} <span className="text-on-surface-variant">({d.category || 'General'})</span>
                </span>
                <a href={d.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                  Open
                </a>
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
                <p className="text-sm text-on-surface-variant">
                  {a.content} — {a.author.fullName}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardShell>
  )
}
