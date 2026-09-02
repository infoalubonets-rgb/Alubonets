import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { syncOverdueActionPoints } from '@/lib/documents'
import { getResolutionsForViewer } from '@/lib/data/queries'
import { actionPublishMeetingMinutes } from '@/app/actions/meetings'
import CreateResolutionForm from '@/components/governance/CreateResolutionForm'
import ResolutionsFeed from '@/components/governance/ResolutionsFeed'
import {
  addActionPoint,
  addAgendaItem,
  circulateMeetingNotice,
  createMinutesRevision,
} from '@/app/actions/governance'
import { todayInputValue } from '@/lib/dates'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const
const RESOLUTION_CREATOR_ROLES = ['SECRETARY', 'ORGANIZER', 'TREASURER', 'ADMIN']

export default async function ManageGovernancePage() {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE'])
  await syncOverdueActionPoints()
  const canManage = actor.role === 'ADMIN' || actor.role === 'SECRETARY'
  const canCreateResolution = RESOLUTION_CREATOR_ROLES.includes(actor.role)
  const [meetings, members, resolutions] = await Promise.all([
    prisma.meeting.findMany({
      include: {
        agendaItems: { orderBy: { position: 'asc' } },
        actionPoints: { include: { owner: true } },
        decisions: true,
        versions: { orderBy: { version: 'desc' } },
      },
      orderBy: { heldAt: 'desc' },
      take: 50,
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      include: { memberProfile: true },
      orderBy: { fullName: 'asc' },
    }),
    getResolutionsForViewer(actor),
  ])
  const committee = members.filter(
    (member) => member.role !== 'MEMBER' || member.memberProfile?.memberCategory === 'COMMITTEE_MEMBER',
  )

  return (
    <DashboardShell role={actor.role} title="Governance management" nav={navForRole(actor.role)}>
      <div className="space-y-5 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="font-h3 text-xl text-primary">Meeting governance workflow</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Circulate notices, structure agendas, register decisions, assign action points,
                approve minutes, and preserve revisions for accountability.
              </p>
            </div>
            {canManage && (
              <Link
                href="/dashboard/secretary/meetings/new"
                className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
              >
                Create meeting record
              </Link>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {canCreateResolution && <CreateResolutionForm />}
          <ResolutionsFeed
            pending={resolutions.pending}
            approved={resolutions.approved}
            canApprove={resolutions.canApprove}
            fullDetail={resolutions.fullDetail}
          />
        </section>

        {!meetings.length && (
          <section className="rounded-2xl border border-dashed bg-surface p-6 text-center">
            <h2 className="font-h3 text-lg text-primary">No meeting records yet</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Governance activity will appear here after a meeting record is created. No sample
              decisions or minutes are shown because these must be official group records.
            </p>
          </section>
        )}
        {meetings.map((meeting) => (
          <article key={meeting.id} className="rounded-2xl border bg-surface p-5">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-h3 text-xl text-primary">{meeting.title}</h2>
                <p className="text-sm">
                  {meeting.heldAt.toLocaleString()} · {meeting.status} · minutes v{meeting.minutesVersion}
                </p>
              </div>
              {meeting.status === 'PENDING_APPROVAL' &&
                (actor.role === 'ADMIN' || actor.role === 'EXECUTIVE') && (
                  <form
                    action={async () => {
                      'use server'
                      await actionPublishMeetingMinutes(meeting.id)
                    }}
                  >
                    <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">
                      Approve and publish minutes
                    </button>
                  </form>
                )}
            </div>

            {meeting.status === 'FINAL' && canManage && (
              <form action={createMinutesRevision} className="mt-3">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <input
                  name="reason"
                  required
                  minLength={5}
                  placeholder="Reason for new minutes version"
                  className="rounded-lg border px-2 py-1"
                />
                <button className="ml-2 text-sm text-primary underline">
                  Create revision v{meeting.minutesVersion + 1}.0
                </button>
              </form>
            )}

            {meeting.versions.length > 0 && (
              <div className="mt-4 rounded-xl border border-outline-variant/60 bg-surface-container-low p-3">
                <b className="text-sm">Minutes version history</b>
                <ul className="mt-2 space-y-2 text-sm">
                  {meeting.versions.map((version) => {
                    const snap = version.snapshot as {
                      minutes?: string | null
                      agenda?: string | null
                      resolutions?: string | null
                    } | null
                    return (
                      <li key={version.id} className="rounded-lg border bg-surface p-2">
                        <p>
                          <b>v{version.version}</b> · {version.createdAt.toLocaleString()}
                        </p>
                        <p className="text-xs text-on-surface-variant">Reason: {version.reason}</p>
                        {snap?.minutes && (
                          <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs">{snap.minutes}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {canManage && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <form action={circulateMeetingNotice} className="space-y-2 rounded-xl bg-surface-container-low p-3">
                  <b>Circulate notice</b>
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <textarea
                    name="noticeBody"
                    required
                    placeholder="Notice message"
                    className="block w-full rounded-lg border px-3 py-2"
                  />
                  <select name="audienceType" className="rounded-lg border px-2 py-1">
                    <option>ALL_MEMBERS</option>
                    <option>SELECTED_ROLES</option>
                    <option>SELECTED_MEMBERS</option>
                    <option>MIXED</option>
                  </select>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {ROLES.map((role) => (
                      <label key={role}>
                        <input type="checkbox" name="audienceRoles" value={role} /> {role}
                      </label>
                    ))}
                  </div>
                  <select name="memberIds" multiple className="h-24 w-full rounded-lg border px-2">
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-full bg-primary px-3 py-1.5 text-sm text-on-primary">
                    Send email and notification
                  </button>
                </form>
                <div className="space-y-3">
                  <form action={addAgendaItem} className="rounded-xl bg-surface-container-low p-3">
                    <b>Add agenda item</b>
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <input
                      name="title"
                      required
                      placeholder="Title"
                      className="mt-2 block w-full rounded-lg border px-2 py-1"
                    />
                    <input
                      name="description"
                      placeholder="Description"
                      className="mt-1 block w-full rounded-lg border px-2 py-1"
                    />
                    <button className="mt-2 text-sm text-primary underline">Add</button>
                  </form>
                  <form action={addActionPoint} className="rounded-xl bg-surface-container-low p-3">
                    <b>Add action point</b>
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <input
                      name="title"
                      required
                      placeholder="Action"
                      className="mt-2 block w-full rounded-lg border px-2 py-1"
                    />
                    <select name="ownerId" required className="mt-1 w-full rounded-lg border px-2 py-1">
                      {committee.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                    <input name="dueAt" type="date" min={todayInputValue()} title="An action point cannot be due in the past." className="mt-1 rounded-lg border px-2 py-1" />
                    <button className="ml-2 text-sm text-primary underline">Assign</button>
                  </form>
                </div>
              </div>
            )}

            <div className="mt-4 text-sm">
              <b>Agenda:</b>{' '}
              {meeting.agendaItems.map((item) => item.title).join(', ') || 'No structured items'} ·{' '}
              <b>Actions:</b> {meeting.actionPoints.length} · <b>Decisions:</b>{' '}
              {meeting.decisions.length}
            </div>
            {meeting.actionPoints.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
                {meeting.actionPoints.map((point) => (
                  <li key={point.id}>
                    {point.title} → {point.owner.fullName} · {point.status}
                    {point.dueAt ? ` · due ${point.dueAt.toLocaleDateString()}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </DashboardShell>
  )
}
