'use client'

import { useMemo, useState, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { setSelectedDocumentStatus } from '@/app/actions/documents'
import { useReportsFilter } from './ReportsFilterContext'

type Report = {
  id: string
  title: string
  description: string | null
  status: string
  uploaderName: string
  uploadedAt: string
}

type Meeting = {
  id: string
  title: string
  status: string
  heldAt: string
  location: string | null
  attendance: number
  recorderName: string
  approvedByName: string | null
  approvedAt: string | null
  agenda: string | null
  minutes: string | null
  opening: string | null
  attendees: string | null
  membersAbsent: string | null
  membersApology: string | null
  resolutions: string | null
  aob: string | null
  nextMeetingAt: string | null
  publishedDocumentId: string | null
  agendaItems: { title: string; description: string | null }[]
  actionPoints: { title: string; description: string | null; ownerName: string; status: string; dueAt: string | null }[]
  decisions: { title: string; decision: string; reference: string; decidedAt: string }[]
}

type Row =
  | { type: 'MEETING'; date: string; meeting: Meeting }
  | { type: 'REPORT'; date: string; report: Report }

function linesFrom(value: string | null | undefined) {
  if (!value?.trim()) return []
  return value
    .split(/\r?\n|,|;/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function DocSection({ title, children, show }: { title: string; children: ReactNode; show?: boolean }) {
  if (show === false) return null
  return (
    <section className="pt-5">
      <div className="mb-2 flex items-center gap-2 border-b border-primary/15 pb-1.5">
        <span className="h-3.5 w-1 rounded-full bg-secondary-container" aria-hidden />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{title}</h3>
      </div>
      <div className="text-[14px] leading-relaxed text-on-surface">{children}</div>
    </section>
  )
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function Prose({ value }: { value: string | null | undefined }) {
  if (!hasText(value)) return null
  return <p className="whitespace-pre-line">{value}</p>
}

function NameList({ value }: { value: string | null | undefined }) {
  const names = linesFrom(value)
  if (!names.length) return null
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5">
      {names.map((name, index) => (
        <li key={`${index}-${name}`}>{name}</li>
      ))}
    </ul>
  )
}

function MeetingMinutesDocument({ meeting }: { meeting: Meeting }) {
  const held = new Date(meeting.heldAt)
  const dateLine = held.toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeLine = held.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  const pdfHref = meeting.publishedDocumentId
    ? `/api/documents/${meeting.publishedDocumentId}/download`
    : `/api/pdf/minutes/${meeting.id}`

  return (
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-outline-variant/70 bg-[#fbfcfe] shadow-[0_10px_30px_rgba(0,31,80,0.08)] dark:border-[#1a2d4f] dark:bg-[#0a1628]">
      <header className="bg-primary px-5 py-4 text-on-primary sm:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-fixed-dim/90">
          Alubonets SHG · Meeting minutes
        </p>
        <h2 className="mt-1 font-h3 text-xl text-white sm:text-2xl">{meeting.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-primary-fixed-dim">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              meeting.status === 'FINAL' ? 'bg-secondary-container text-on-primary' : 'bg-white/15 text-white'
            }`}
          >
            {meeting.status}
          </span>
          <span>
            {dateLine}, {timeLine}
          </span>
          {meeting.location && <span>· {meeting.location}</span>}
        </div>
      </header>
      <div className="h-1 bg-secondary-container" aria-hidden />

      <div className="space-y-1 px-5 py-5 sm:px-7 sm:py-6">
        <div className="rounded-xl bg-primary/[0.04] px-4 py-3 text-sm dark:bg-white/[0.04]">
          <p>
            <span className="font-semibold text-primary">Recorded by:</span> {meeting.recorderName}
          </p>
          {meeting.approvedByName && (
            <p className="mt-1">
              <span className="font-semibold text-primary">Approved by:</span> {meeting.approvedByName}
              {meeting.approvedAt ? ` · ${new Date(meeting.approvedAt).toLocaleString('en-KE')}` : ''}
            </p>
          )}
          <p className="mt-1">
            <span className="font-semibold text-primary">Total present:</span> {meeting.attendance}
          </p>
        </div>

        {(meeting.attendees || meeting.membersApology || meeting.membersAbsent) && (
          <DocSection title="Attendance">
            <div className="space-y-3">
              {meeting.attendees && (
                <div>
                  <p className="text-[12px] font-semibold text-on-surface-variant">Present</p>
                  <NameList value={meeting.attendees} />
                </div>
              )}
              {meeting.membersApology && (
                <div>
                  <p className="text-[12px] font-semibold text-on-surface-variant">Absent with apology</p>
                  <NameList value={meeting.membersApology} />
                </div>
              )}
              {meeting.membersAbsent && (
                <div>
                  <p className="text-[12px] font-semibold text-on-surface-variant">Absent</p>
                  <NameList value={meeting.membersAbsent} />
                </div>
              )}
            </div>
          </DocSection>
        )}

        <DocSection title="Opening" show={hasText(meeting.opening)}>
          <Prose value={meeting.opening} />
        </DocSection>

        <DocSection title="Agenda" show={hasText(meeting.agenda) || meeting.agendaItems.length > 0}>
          <Prose value={meeting.agenda} />
          {meeting.agendaItems.length > 0 && (
            <ol className={`list-decimal space-y-2 pl-5 ${hasText(meeting.agenda) ? 'mt-3' : ''}`}>
              {meeting.agendaItems.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <span className="font-semibold">{item.title}</span>
                  {item.description && <p className="mt-0.5 text-on-surface-variant">{item.description}</p>}
                </li>
              ))}
            </ol>
          )}
        </DocSection>

        <DocSection title="Discussion / Minutes" show={hasText(meeting.minutes)}>
          <Prose value={meeting.minutes} />
        </DocSection>

        <DocSection title="Resolutions" show={hasText(meeting.resolutions)}>
          <Prose value={meeting.resolutions} />
        </DocSection>

        {meeting.decisions.length > 0 && (
          <DocSection title="Decision register">
            <ol className="space-y-3">
              {meeting.decisions.map((item) => (
                <li key={item.reference} className="rounded-xl border border-outline-variant/50 bg-white px-3 py-2.5 dark:bg-[#102039]">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{item.reference}</p>
                  <p className="mt-0.5 font-semibold">{item.title}</p>
                  <p className="mt-1 whitespace-pre-line text-on-surface-variant">{item.decision}</p>
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    Decided {new Date(item.decidedAt).toLocaleDateString('en-KE')}
                  </p>
                </li>
              ))}
            </ol>
          </DocSection>
        )}

        {meeting.actionPoints.length > 0 && (
          <DocSection title="Action points">
            <ul className="space-y-2">
              {meeting.actionPoints.map((item, index) => (
                <li key={`${item.title}-${index}`} className="rounded-xl border border-outline-variant/50 bg-white px-3 py-2.5 dark:bg-[#102039]">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">
                    {item.ownerName} · {item.status}
                    {item.dueAt ? ` · Due ${new Date(item.dueAt).toLocaleDateString('en-KE')}` : ''}
                  </p>
                  {item.description && <p className="mt-1 whitespace-pre-line">{item.description}</p>}
                </li>
              ))}
            </ul>
          </DocSection>
        )}

        <DocSection title="Any other business (AOB)" show={hasText(meeting.aob)}>
          <Prose value={meeting.aob} />
        </DocSection>

        {meeting.nextMeetingAt && (
          <DocSection title="Next meeting">
            <p>
              {new Date(meeting.nextMeetingAt).toLocaleDateString('en-KE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {', '}
              {new Date(meeting.nextMeetingAt).toLocaleTimeString('en-KE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </DocSection>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 pt-5">
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Open minutes PDF in new tab
          </a>
        </div>
      </div>
    </article>
  )
}

function ReportDocument({ report }: { report: Report }) {
  return (
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-outline-variant/70 bg-[#fbfcfe] shadow-[0_10px_30px_rgba(0,31,80,0.08)] dark:border-[#1a2d4f] dark:bg-[#0a1628]">
      <header className="bg-primary px-5 py-4 text-on-primary sm:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-fixed-dim/90">
          Alubonets SHG · Report
        </p>
        <h2 className="mt-1 font-h3 text-xl text-white sm:text-2xl">{report.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-primary-fixed-dim">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {report.status}
          </span>
          <span>
            Shared by {report.uploaderName} · {new Date(report.uploadedAt).toLocaleString('en-KE')}
          </span>
        </div>
      </header>
      <div className="h-1 bg-secondary-container" aria-hidden />
      <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
        {report.description ? (
          <DocSection title="Summary">
            <Prose value={report.description} />
          </DocSection>
        ) : (
          <p className="text-sm text-on-surface-variant">No written summary was provided with this report.</p>
        )}
        <a
          href={`/api/documents/${report.id}/download`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Open report file in new tab
        </a>
      </div>
    </article>
  )
}

export default function ReportsMeetingsRows({ reports, meetings }: { reports: Report[]; meetings: Meeting[] }) {
  const { filter } = useReportsFilter()
  const [selected, setSelected] = useState<Row | null>(null)
  const rows = useMemo<Row[]>(
    () =>
      [
        ...meetings.map((meeting): Row => ({ type: 'MEETING', date: meeting.heldAt, meeting })),
        ...reports.map((report): Row => ({ type: 'REPORT', date: report.uploadedAt, report })),
      ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [meetings, reports],
  )
  const visible = filter === 'ALL' ? rows : rows.filter((row) => row.type === filter)

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        {visible.map((row) => {
          const item = row.type === 'MEETING' ? row.meeting : row.report
          return (
            <div
              key={`${row.type}-${item.id}`}
              className="flex flex-wrap items-center gap-3 border-b border-outline-variant/60 px-4 py-3 last:border-b-0 sm:px-5"
            >
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  row.type === 'MEETING' ? 'bg-primary/10 text-primary' : 'bg-secondary-container/15 text-secondary'
                }`}
              >
                {row.type === 'MEETING' ? 'Meeting' : 'Report'}
              </span>
              <span className="material-symbols-outlined text-primary">
                {row.type === 'MEETING' ? 'groups' : 'assessment'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-on-surface">{item.title}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {new Date(row.date).toLocaleDateString('en-KE')} ·{' '}
                  {row.type === 'MEETING' ? row.meeting.recorderName : row.report.uploaderName} · {item.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(row)}
                aria-label={`View details for ${item.title}`}
                title="View details"
                className="grid h-9 w-9 place-items-center rounded-full border border-primary/25 text-primary transition hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-[19px]">visibility</span>
              </button>
              {row.type === 'REPORT' && (
                <form action={setSelectedDocumentStatus}>
                  <input type="hidden" name="singleId" value={row.report.id} />
                  <button
                    name="status"
                    value={row.report.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'}
                    className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    {row.report.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
                  </button>
                </form>
              )}
            </div>
          )
        })}
        {!visible.length && (
          <p className="p-8 text-center text-sm text-on-surface-variant">
            No {filter === 'ALL' ? 'meetings or reports' : filter === 'MEETING' ? 'meetings' : 'reports'} yet.
          </p>
        )}
      </div>

      <FullScreenModal
        open={Boolean(selected)}
        title={selected?.type === 'MEETING' ? 'Meeting minutes' : selected?.type === 'REPORT' ? 'Report' : 'Details'}
        onClose={() => setSelected(null)}
      >
        {selected?.type === 'REPORT' && <ReportDocument report={selected.report} />}
        {selected?.type === 'MEETING' && <MeetingMinutesDocument meeting={selected.meeting} />}
      </FullScreenModal>
    </section>
  )
}
