import DashboardShell, { type NavItem } from '@/components/dashboard/DashboardShell'
import { actionCreateEvent, actionCreateGallery, actionUpsertProject } from '@/app/actions/domain'
import { getOrganizerDashboardData } from '@/lib/data/queries'

const NAV: NavItem[] = [
  { icon: 'event', label: 'Events', active: true },
  { icon: 'photo_library', label: 'Gallery' },
  { icon: 'work', label: 'Projects' },
]

export default async function OrganizerPage() {
  const data = await getOrganizerDashboardData()

  return (
    <DashboardShell role="ORGANIZER" title="Organizer" nav={NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Events', value: data.events.length },
            { label: 'Upcoming', value: data.upcoming.length },
            { label: 'Gallery items', value: data.gallery.length },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-surface p-4">
              <p className="text-xs text-on-surface-variant uppercase">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Create event</h2>
          <form action={actionCreateEvent} className="grid gap-3 md:grid-cols-2">
            <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
            <input name="startsAt" type="datetime-local" required className="border rounded-lg px-3 py-2" />
            <input name="location" placeholder="Location" className="border rounded-lg px-3 py-2" />
            <input name="description" placeholder="Description" className="border rounded-lg px-3 py-2" />
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2 md:col-span-2">Save event</button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Upcoming events</h2>
          <ul className="space-y-2 text-sm">
            {data.upcoming.map((e) => (
              <li key={e.id} className="border-b pb-2">
                <p className="font-medium">{e.title}</p>
                <p className="text-on-surface-variant">
                  {e.startsAt.toLocaleString()}
                  {e.location ? ` · ${e.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Add gallery photo (URL)</h2>
          <form action={actionCreateGallery} className="grid gap-3 md:grid-cols-2">
            <input name="url" placeholder="Image URL" required className="border rounded-lg px-3 py-2 md:col-span-2" />
            <input name="caption" placeholder="Caption" className="border rounded-lg px-3 py-2" />
            <input name="category" placeholder="Category" className="border rounded-lg px-3 py-2" />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="publish" /> Publish immediately
            </label>
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2 md:col-span-2">
              Upload metadata
            </button>
          </form>
        </section>

        <section className="rounded-xl border bg-surface p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.gallery.map((g) => (
            <figure key={g.id} className="border rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt={g.caption || 'Gallery'} className="h-36 w-full object-cover" />
              <figcaption className="p-2 text-xs">
                {g.caption || 'Untitled'} · {g.isPublic ? 'Public' : 'Pending'}
              </figcaption>
            </figure>
          ))}
        </section>

        <section className="rounded-xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">Project</h2>
          <form action={actionUpsertProject} className="grid gap-3">
            <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
            <textarea name="description" placeholder="Description" required className="border rounded-lg px-3 py-2" />
            <select name="status" className="border rounded-lg px-3 py-2">
              <option value="UPCOMING">UPCOMING</option>
              <option value="ONGOING">ONGOING</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <button className="bg-primary text-on-primary rounded-lg px-4 py-2">Save project</button>
          </form>
        </section>
      </div>
    </DashboardShell>
  )
}
