'use client'

import { useMemo, useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { setSelectedDocumentStatus } from '@/app/actions/documents'

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

function Detail({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === '') return null
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-on-surface">{value}</dd>
    </div>
  )
}

export default function ReportsMeetingsRows({ reports, meetings }: { reports: Report[]; meetings: Meeting[] }) {
  const [filter, setFilter] = useState<'ALL' | 'MEETING' | 'REPORT'>('ALL')
  const [selected, setSelected] = useState<Row | null>(null)
  const rows = useMemo<Row[]>(() => [
    ...meetings.map((meeting): Row => ({ type: 'MEETING', date: meeting.heldAt, meeting })),
    ...reports.map((report): Row => ({ type: 'REPORT', date: report.uploadedAt, report })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [meetings, reports])
  const visible = filter === 'ALL' ? rows : rows.filter((row) => row.type === filter)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-on-surface-variant">Review meeting records and uploaded reports in one place.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          Filter
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm">
            <option value="ALL">All</option>
            <option value="MEETING">Meetings</option>
            <option value="REPORT">Reports</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        {visible.map((row) => {
          const item = row.type === 'MEETING' ? row.meeting : row.report
          return (
            <div key={`${row.type}-${item.id}`} className="flex flex-wrap items-center gap-3 border-b border-outline-variant/60 px-4 py-3 last:border-b-0 sm:px-5">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${row.type === 'MEETING' ? 'bg-primary/10 text-primary' : 'bg-secondary-container/15 text-secondary'}`}>
                {row.type === 'MEETING' ? 'Meeting' : 'Report'}
              </span>
              <span className="material-symbols-outlined text-primary">{row.type === 'MEETING' ? 'groups' : 'assessment'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-on-surface">{item.title}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {new Date(row.date).toLocaleDateString('en-KE')} · {row.type === 'MEETING' ? row.meeting.recorderName : row.report.uploaderName} · {item.status}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(row)} aria-label={`View details for ${item.title}`} title="View details" className="grid h-9 w-9 place-items-center rounded-full border border-primary/25 text-primary transition hover:bg-primary/5">
                <span className="material-symbols-outlined text-[19px]">visibility</span>
              </button>
              {row.type === 'REPORT' && (
                <form action={setSelectedDocumentStatus}>
                  <input type="hidden" name="singleId" value={row.report.id} />
                  <button name="status" value={row.report.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'} className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-primary">
                    {row.report.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
                  </button>
                </form>
              )}
            </div>
          )
        })}
        {!visible.length && <p className="p-8 text-center text-sm text-on-surface-variant">No {filter === 'ALL' ? 'meetings or reports' : filter === 'MEETING' ? 'meetings' : 'reports'} yet.</p>}
      </div>

      <FullScreenModal open={Boolean(selected)} title={selected?.type === 'MEETING' ? selected.meeting.title : selected?.report.title || 'Details'} onClose={() => setSelected(null)}>
        {selected?.type === 'REPORT' && (
          <div className="space-y-5">
            <span className="rounded-full bg-secondary-container/15 px-3 py-1 text-xs font-bold uppercase text-secondary">Report</span>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Status" value={selected.report.status} />
              <Detail label="Uploaded" value={new Date(selected.report.uploadedAt).toLocaleString('en-KE')} />
              <Detail label="Uploaded by" value={selected.report.uploaderName} />
              <Detail label="Description" value={selected.report.description} />
            </dl>
            <a href={`/api/documents/${selected.report.id}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>Open report in new tab
            </a>
          </div>
        )}
        {selected?.type === 'MEETING' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">Meeting</span>
              <span className="text-xs text-on-surface-variant">{selected.meeting.status}</span>
            </div>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Date" value={new Date(selected.meeting.heldAt).toLocaleString('en-KE')} />
              <Detail label="Location" value={selected.meeting.location} />
              <Detail label="Attendance" value={selected.meeting.attendance} />
              <Detail label="Recorded by" value={selected.meeting.recorderName} />
              <Detail label="Approved by" value={selected.meeting.approvedByName} />
              <Detail label="Approved at" value={selected.meeting.approvedAt ? new Date(selected.meeting.approvedAt).toLocaleString('en-KE') : null} />
              <Detail label="Opening" value={selected.meeting.opening} />
              <Detail label="Agenda" value={selected.meeting.agenda} />
              <Detail label="Minutes" value={selected.meeting.minutes} />
              <Detail label="Attendees" value={selected.meeting.attendees} />
              <Detail label="Absent" value={selected.meeting.membersAbsent} />
              <Detail label="Apologies" value={selected.meeting.membersApology} />
              <Detail label="Resolutions" value={selected.meeting.resolutions} />
              <Detail label="Other business" value={selected.meeting.aob} />
              <Detail label="Next meeting" value={selected.meeting.nextMeetingAt ? new Date(selected.meeting.nextMeetingAt).toLocaleString('en-KE') : null} />
            </dl>
            {selected.meeting.agendaItems.length > 0 && <div><h3 className="font-h3 text-base text-primary">Agenda items</h3><ul className="mt-2 space-y-2">{selected.meeting.agendaItems.map((item, index) => <li key={`${item.title}-${index}`} className="rounded-xl bg-surface-container-low p-3 text-sm"><b>{index + 1}. {item.title}</b>{item.description && <p className="mt-1 text-on-surface-variant">{item.description}</p>}</li>)}</ul></div>}
            {selected.meeting.decisions.length > 0 && <div><h3 className="font-h3 text-base text-primary">Decisions</h3><ul className="mt-2 space-y-2">{selected.meeting.decisions.map((item) => <li key={item.reference} className="rounded-xl bg-surface-container-low p-3 text-sm"><b>{item.title}</b><p className="mt-1 text-on-surface-variant">{item.decision}</p></li>)}</ul></div>}
            {selected.meeting.actionPoints.length > 0 && <div><h3 className="font-h3 text-base text-primary">Action points</h3><ul className="mt-2 space-y-2">{selected.meeting.actionPoints.map((item, index) => <li key={`${item.title}-${index}`} className="rounded-xl bg-surface-container-low p-3 text-sm"><b>{item.title}</b><p className="mt-1 text-on-surface-variant">{item.ownerName} · {item.status}{item.dueAt ? ` · Due ${new Date(item.dueAt).toLocaleDateString('en-KE')}` : ''}</p>{item.description && <p className="mt-1">{item.description}</p>}</li>)}</ul></div>}
            <a href={selected.meeting.publishedDocumentId ? `/api/documents/${selected.meeting.publishedDocumentId}/download` : `/api/pdf/minutes/${selected.meeting.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>Open minutes PDF in new tab
            </a>
          </div>
        )}
      </FullScreenModal>
    </section>
  )
}
