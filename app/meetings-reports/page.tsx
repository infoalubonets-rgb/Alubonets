import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { canReadDocument } from '@/lib/documents'
import { ATTENDANCE_RECORDS_INCLUDE, attendanceLists } from '@/lib/meeting-attendance'
import { uploadReport } from '@/app/actions/documents'
import ReportsMeetingsRows from '@/components/reports/ReportsMeetingsRows'
import AddReportModal from '@/components/reports/AddReportModal'
import ReportsFilterControl from '@/components/reports/ReportsFilterControl'
import { ReportsFilterProvider } from '@/components/reports/ReportsFilterContext'

export const metadata = { title: 'Meetings & reports' }
export const dynamic = 'force-dynamic'

export default async function MeetingsReportsPage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
    'AUDITOR',
  ])
  const canManage = actor.role === 'ADMIN' || actor.role === 'SECRETARY'

  if (canManage) {
    const [reports, meetings] = await Promise.all([
      prisma.document.findMany({
        where: { category: 'Reports' },
        include: { uploader: { select: { fullName: true } } },
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.meeting.findMany({
        include: {
          recorder: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
          publishedDocument: { select: { id: true } },
          agendaItems: { orderBy: { position: 'asc' } },
          actionPoints: { include: { owner: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } },
          decisions: { orderBy: { createdAt: 'asc' } },
          attendanceRecords: ATTENDANCE_RECORDS_INCLUDE,
        },
        orderBy: { heldAt: 'desc' },
      }),
    ])

    return (
      <ReportsFilterProvider>
      <DashboardShell
        role={actor.role}
        title="Meetings & reports"
        nav={navForRole(actor.role)}
        pageAction={
          <div className="flex flex-wrap items-center gap-3">
            <ReportsFilterControl />
            <AddReportModal uploadAction={uploadReport} />
          </div>
        }
      >
        <ReportsMeetingsRows
          reports={reports.map((report) => ({
            id: report.id,
            title: report.title,
            description: report.description,
            status: report.status,
            uploaderName: report.uploader.fullName,
            uploadedAt: report.uploadedAt.toISOString(),
          }))}
          meetings={meetings.map((meeting) => {
            const attendanceNames = attendanceLists(meeting)
            return {
            id: meeting.id,
            title: meeting.title,
            status: meeting.status,
            heldAt: meeting.heldAt.toISOString(),
            location: meeting.location,
            attendance: meeting.attendance,
            recorderName: meeting.recorder.fullName,
            approvedByName: meeting.approvedBy?.fullName || null,
            approvedAt: meeting.approvedAt?.toISOString() || null,
            agenda: meeting.agenda,
            minutes: meeting.minutes,
            opening: meeting.opening,
            attendees: attendanceNames.present || null,
            membersAbsent: attendanceNames.absent || null,
            membersApology: attendanceNames.apology || null,
            resolutions: meeting.resolutions,
            aob: meeting.aob,
            nextMeetingAt: meeting.nextMeetingAt?.toISOString() || null,
            publishedDocumentId: meeting.publishedDocument?.id || null,
            agendaItems: meeting.agendaItems.map((item) => ({ title: item.title, description: item.description })),
            actionPoints: meeting.actionPoints.map((point) => ({
              title: point.title,
              description: point.description,
              ownerName: point.owner.fullName,
              status: point.status,
              dueAt: point.dueAt?.toISOString() || null,
            })),
            decisions: meeting.decisions.map((decision) => ({
              title: decision.title,
              decision: decision.decision,
              reference: decision.reference,
              decidedAt: decision.decidedAt.toISOString(),
            })),
            }
          })}
        />
      </DashboardShell>
      </ReportsFilterProvider>
    )
  }

  const [meetings, reportRows] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        status: 'FINAL',
        OR: [
          { audienceType: 'ALL_MEMBERS' },
          { audienceRoles: { has: actor.role } },
          { invitations: { some: { userId: actor.id } } },
        ],
      },
      include: {
        publishedDocument: { select: { id: true, title: true } },
        recorder: { select: { fullName: true } },
      },
      orderBy: { heldAt: 'desc' },
    }),
    prisma.document.findMany({
      where: { category: 'Reports', status: 'PUBLISHED' },
      include: { uploader: { select: { fullName: true } } },
      orderBy: { uploadedAt: 'desc' },
    }),
  ])
  const reports = reportRows.filter((report) => canReadDocument(report, actor.role))

  return (
    <DashboardShell role={actor.role} title="Meetings & reports" nav={navForRole(actor.role)}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((meeting) => (
            <article key={meeting.id} className="rounded-2xl border border-outline-variant/60 bg-surface p-5 shadow-[0_6px_20px_rgba(0,31,80,0.06)]">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <span className="text-[9px] font-bold uppercase">{meeting.heldAt.toLocaleDateString('en-KE', { month: 'short' })}</span>
                  <span className="text-xl font-bold leading-none">{meeting.heldAt.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-h3 text-base text-primary">{meeting.title}</h3>
                    <span className="rounded-full bg-primary/5 px-2.5 py-1 text-[9px] font-label-bold uppercase tracking-wider text-primary">Approved</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {meeting.heldAt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}{meeting.attendance} present
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">Recorded by {meeting.recorder.fullName}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant/40 pt-4">
                {meeting.publishedDocument ? (
                  <a href={`/api/documents/${meeting.publishedDocument.id}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2 text-xs font-label-bold text-on-primary">
                    <span className="material-symbols-outlined text-[17px]">picture_as_pdf</span>
                    View approved minutes
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[17px]">schedule</span>
                    Publication pending
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>

        {reports.length > 0 && (
          <section>
            <h2 className="mb-3 font-h3 text-lg text-primary">Published reports</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {reports.map((report) => (
                <article key={report.id} className="rounded-2xl border border-outline-variant/60 bg-surface p-5 shadow-[0_6px_20px_rgba(0,31,80,0.06)]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-container/10 text-secondary"><span className="material-symbols-outlined">assessment</span></div>
                    <div className="min-w-0 flex-1"><h3 className="font-h3 text-base text-primary">{report.title}</h3><p className="mt-1 text-xs text-on-surface-variant">Shared by {report.uploader.fullName} · {report.uploadedAt.toLocaleDateString()}</p></div>
                  </div>
                  {report.description && <p className="mt-3 text-sm text-on-surface-variant">{report.description}</p>}
                  <a href={`/api/documents/${report.id}/download`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2 text-xs font-label-bold text-on-primary"><span className="material-symbols-outlined text-[17px]">open_in_new</span>View report</a>
                </article>
              ))}
            </div>
          </section>
        )}

        {!meetings.length && !reports.length && (
          <div className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low/40 px-5 py-14 text-center">
            <span className="material-symbols-outlined text-[36px] text-primary/35">summarize</span>
            <h3 className="mt-2 font-h3 text-lg text-primary">No approved records yet</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Published meeting minutes and reports available to you will appear here.</p>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
