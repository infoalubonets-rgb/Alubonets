import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { syncOverdueActionPoints } from '@/lib/documents'
import { markMeetingNoticesRead, updateActionPointStatus } from '@/app/actions/governance'

export default async function GovernancePage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
  ])
  await Promise.all([syncOverdueActionPoints(), markMeetingNoticesRead()])
  const [notices, decisions, actionPoints] = await Promise.all([
    prisma.meetingInvitation.findMany({
      where: { userId: actor.id },
      include: { meeting: true },
      orderBy: { meeting: { heldAt: 'desc' } },
    }),
    prisma.meetingDecision.findMany({
      include: { meeting: true },
      orderBy: { decidedAt: 'desc' },
      take: 100,
    }),
    prisma.meetingActionPoint.findMany({
      where:
        actor.role === 'ADMIN' || actor.role === 'SECRETARY' ? {} : { ownerId: actor.id },
      include: { meeting: true, owner: true },
      orderBy: { dueAt: 'asc' },
    }),
  ])

  return (
    <DashboardShell role={actor.role} title="Governance" nav={navForRole(actor.role)}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="font-h3 text-xl text-primary">Group governance centre</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Follow official meeting notices, decisions made by the group, and action points
                assigned after meetings. Approved minutes and governance files are published in
                the document repository.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/documents"
                className="rounded-full border border-primary px-4 py-2 text-sm text-primary"
              >
                View approved records
              </Link>
              {(actor.role === 'ADMIN' || actor.role === 'SECRETARY') && (
                <Link
                  href="/governance/manage"
                  className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
                >
                  Manage governance
                </Link>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-h3 text-xl text-primary">Meeting notices</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {notices.map(({ meeting, readAt, sentAt }) => (
              <article key={meeting.id} className="rounded-2xl border bg-surface p-4">
                <div className="flex justify-between gap-2">
                  <b>{meeting.title}</b>
                  <span className="text-xs text-on-surface-variant">
                    {readAt ? 'Read' : 'New'}
                  </span>
                </div>
                <p className="text-sm">
                  {meeting.heldAt.toLocaleString()} · {meeting.location || 'Location to be confirmed'}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm">{meeting.noticeBody}</p>
                {sentAt && (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Sent {sentAt.toLocaleString()}
                  </p>
                )}
              </article>
            ))}
          </div>
          {!notices.length && <p className="mt-2 text-sm">No meeting notices for you.</p>}
        </section>

        <section>
          <h2 className="font-h3 text-xl text-primary">Decision register</h2>
          <div className="mt-3 space-y-3">
            {decisions.map((decision) => (
              <article key={decision.id} className="rounded-2xl border bg-surface p-4">
                <b>
                  {decision.reference} · {decision.title}
                </b>
                <p className="mt-1 text-sm">{decision.decision}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {decision.meeting.title} · {decision.decidedAt.toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
          {!decisions.length && (
            <p className="mt-2 rounded-xl border bg-surface p-4 text-sm text-on-surface-variant">
              No decisions have been published yet. Decisions will appear here after they are
              formally recorded from a meeting.
            </p>
          )}
        </section>

        <section>
            <h2 className="font-h3 text-xl text-primary">Action points</h2>
            {!actionPoints.length && (
              <p className="mt-2 rounded-xl border bg-surface p-4 text-sm text-on-surface-variant">
                You have no assigned action points. Tasks created from meeting resolutions will
                appear here with their owner, deadline, and progress status.
              </p>
            )}
            <div className="mt-3 space-y-3">
              {actionPoints.map((point) => (
                <article key={point.id} className="rounded-2xl border bg-surface p-4">
                  <b>{point.title}</b>
                  <p className="text-sm">
                    {point.meeting.title} · Owner: {point.owner.fullName} · Due:{' '}
                    {point.dueAt?.toLocaleDateString() || 'No deadline'} · {point.status}
                  </p>
                  <form action={updateActionPointStatus} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={point.id} />
                    <select
                      name="status"
                      defaultValue={point.status}
                      className="rounded-lg border px-2 py-1 text-sm"
                    >
                      <option>OPEN</option>
                      <option>IN_PROGRESS</option>
                      <option>COMPLETED</option>
                      <option>OVERDUE</option>
                      <option>CANCELLED</option>
                    </select>
                    <input
                      name="reason"
                      required
                      placeholder="Reason/update note"
                      className="rounded-lg border px-2 py-1 text-sm"
                    />
                    <button className="text-sm text-primary underline">Update</button>
                  </form>
                </article>
              ))}
            </div>
          </section>
      </div>
    </DashboardShell>
  )
}
