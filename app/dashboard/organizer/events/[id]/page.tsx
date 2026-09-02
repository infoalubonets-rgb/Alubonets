import Link from 'next/link'
import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { ORGANIZER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import {
  addEventAttachment,
  addEventCost,
  circulateEventInvitations,
  publishEventReport,
  recordEventAttendance,
  upsertEventDetails,
} from '@/app/actions/events'
import { moneyNumber } from '@/lib/projects'
import { lowerBoundFor } from '@/lib/dates'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

export default async function OrganizerEventManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireActiveRole(['ORGANIZER', 'ADMIN', 'SECRETARY'])
  const { id } = await params
  const [event, members] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        rsvps: { include: { user: { select: { id: true, fullName: true } } }, orderBy: { respondedAt: 'desc' } },
        attendance: { include: { user: { select: { fullName: true } } } },
        invitations: { include: { user: { select: { fullName: true } } } },
        costs: { orderBy: { createdAt: 'desc' } },
        attachments: true,
      },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ])
  if (!event) notFound()
  // These fields share the page's existing UTC `toISOString().slice(0, 16)` convention.
  // An event already in the past keeps its own start time as the floor so it stays editable.
  const notBeforeNow = new Date().toISOString().slice(0, 16)
  const minStartsAt = lowerBoundFor(notBeforeNow, event.startsAt.toISOString().slice(0, 16))
  const minRsvpDeadlineAt = lowerBoundFor(notBeforeNow, event.rsvpDeadlineAt?.toISOString().slice(0, 16))
  const rsvpAnalytics = {
    going: event.rsvps.filter((rsvp) => rsvp.status === 'GOING').length,
    maybe: event.rsvps.filter((rsvp) => rsvp.status === 'MAYBE').length,
    notGoing: event.rsvps.filter((rsvp) => rsvp.status === 'NOT_GOING').length,
  }

  return (
    <DashboardShell role="ORGANIZER" title="Manage event" nav={ORGANIZER_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <Link href="/dashboard/organizer/events" className="text-sm text-primary underline">
          Back to events
        </Link>
        <h1 className="font-h3 text-2xl text-primary">{event.title}</h1>
        <p className="text-sm">
          {event.startsAt.toLocaleString()} · {event.audienceType} · RSVPs {event.rsvps.length}
          {event.capacity ? ` / ${event.capacity}` : ''}
        </p>
        <section aria-label="RSVP analytics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Going', value: rsvpAnalytics.going, icon: 'check_circle', tone: 'border-green-200 bg-green-50 text-green-800' },
            { label: 'Maybe', value: rsvpAnalytics.maybe, icon: 'help', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
            { label: 'Not going', value: rsvpAnalytics.notGoing, icon: 'cancel', tone: 'border-red-200 bg-red-50 text-red-800' },
            { label: 'Total responses', value: event.rsvps.length, icon: 'groups', tone: 'border-blue-200 bg-blue-50 text-primary' },
          ].map((stat) => (
            <div key={stat.label} className={`flex items-center gap-3 rounded-2xl border p-4 ${stat.tone}`}>
              <span className="material-symbols-outlined text-[22px]">{stat.icon}</span>
              <div><p className="text-2xl font-black leading-none">{stat.value}</p><p className="mt-1 text-xs font-bold">{stat.label}</p></div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Event details</h2>
          <form action={upsertEventDetails} className="mt-3 grid gap-2 md:grid-cols-3">
            <input type="hidden" name="id" value={event.id} />
            <input name="title" required defaultValue={event.title} className="rounded-lg border px-3 py-2" />
            <input
              name="startsAt"
              type="datetime-local"
              required
              min={minStartsAt}
              title="Choose a date and time that is not in the past."
              defaultValue={event.startsAt.toISOString().slice(0, 16)}
              className="rounded-lg border px-3 py-2"
            />
            <input name="location" defaultValue={event.location || ''} placeholder="Location" className="rounded-lg border px-3 py-2" />
            <input name="mapsUrl" type="url" defaultValue={event.mapsUrl || ''} placeholder="Maps directions link (optional)" className="rounded-lg border px-3 py-2" />
            <textarea name="description" defaultValue={event.description || ''} className="rounded-lg border px-3 py-2 md:col-span-3" />
            <select name="audienceType" defaultValue={event.audienceType} className="rounded-lg border px-3 py-2">
              <option value="PUBLIC">Public</option>
              <option value="ALL_MEMBERS">All members</option>
              <option value="SELECTED_ROLES">Selected roles</option>
              <option value="SELECTED_MEMBERS">Selected members</option>
            </select>
            <input name="capacity" type="number" min={1} defaultValue={event.capacity ?? ''} placeholder="Capacity" className="rounded-lg border px-3 py-2" />
            <input
              name="rsvpDeadlineAt"
              type="datetime-local"
              min={minRsvpDeadlineAt}
              title="Choose an RSVP deadline that is not in the past."
              defaultValue={event.rsvpDeadlineAt?.toISOString().slice(0, 16) || ''}
              className="rounded-lg border px-3 py-2"
            />
            <input name="budgetKes" type="number" min={0} step="0.01" defaultValue={moneyNumber(event.budgetKes)} className="rounded-lg border px-3 py-2" />
            <input
              name="reminderOffsetsHours"
              defaultValue={event.reminderOffsetsHours.join(',')}
              placeholder="Reminder hours e.g. 24,2"
              className="rounded-lg border px-3 py-2"
            />
            <fieldset className="flex flex-wrap gap-2 text-xs md:col-span-3">
              {ROLES.map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    name="audienceRoles"
                    value={role}
                    defaultChecked={event.audienceRoles.includes(role)}
                  />{' '}
                  {role}
                </label>
              ))}
            </fieldset>
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save</button>
          </form>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Invite members</h2>
            <form action={circulateEventInvitations} className="mt-3 space-y-2">
              <input type="hidden" name="eventId" value={event.id} />
              <select name="memberIds" multiple className="h-40 w-full rounded-lg border px-2">
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
              <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">
                Send invitations
              </button>
            </form>
            <p className="mt-2 text-xs text-on-surface-variant">
              {event.invitations.length} invitation(s) on record
            </p>
          </section>

          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">RSVPs</h2>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {event.rsvps.map((r) => (
                <li key={r.id}>
                  {r.user.fullName} · {r.status}
                </li>
              ))}
              {!event.rsvps.length && <li>No RSVPs yet.</li>}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Attendance</h2>
          <form action={recordEventAttendance} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="eventId" value={event.id} />
            <select name="userId" required className="rounded-lg border px-3 py-2">
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <select name="present" className="rounded-lg border px-3 py-2">
              <option value="true">Present</option>
              <option value="false">Absent</option>
            </select>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Record</button>
          </form>
          <ul className="mt-3 space-y-1 text-sm">
            {event.attendance.map((a) => (
              <li key={a.id}>
                {a.user.fullName} · {a.present ? 'Present' : 'Absent'}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Costs</h2>
            <p className="text-xs">Actual total: KES {moneyNumber(event.actualCostKes).toLocaleString()}</p>
            <form action={addEventCost} className="mt-3 space-y-2">
              <input type="hidden" name="eventId" value={event.id} />
              <input name="label" required placeholder="Cost label" className="w-full rounded-lg border px-3 py-2" />
              <input name="amount" type="number" min={1} step="0.01" required className="w-full rounded-lg border px-3 py-2" />
              <input name="notes" placeholder="Notes" className="w-full rounded-lg border px-3 py-2" />
              <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add cost</button>
            </form>
            <ul className="mt-3 space-y-1 text-sm">
              {event.costs.map((c) => (
                <li key={c.id}>
                  {c.label} · KES {moneyNumber(c.amount).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Attachments</h2>
            <form action={addEventAttachment} className="mt-3 space-y-2">
              <input type="hidden" name="eventId" value={event.id} />
              <input name="title" required placeholder="Title" className="w-full rounded-lg border px-3 py-2" />
              <input name="fileUrl" required type="url" placeholder="https://..." className="w-full rounded-lg border px-3 py-2" />
              <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add attachment</button>
            </form>
            <ul className="mt-3 space-y-1 text-sm">
              {event.attachments.map((a) => (
                <li key={a.id}>
                  <a href={a.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                    {a.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Post-event report</h2>
          <form action={publishEventReport} className="mt-3 space-y-2">
            <input type="hidden" name="eventId" value={event.id} />
            <textarea
              name="reportBody"
              required
              defaultValue={event.reportBody || ''}
              rows={5}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Summary of the event..."
            />
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Publish report</button>
          </form>
        </section>
      </div>
    </DashboardShell>
  )
}
