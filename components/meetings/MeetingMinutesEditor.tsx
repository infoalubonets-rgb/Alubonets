'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  actionCreateMeeting,
  actionUpdateMeeting,
} from '@/app/actions/meetings'
import { submitMinutesForApproval } from '@/app/actions/governance'
import { SITE_LOGO } from '@/lib/constants'
import { lowerBoundFor, nowInputValue } from '@/lib/dates'

export type MeetingEditorValues = {
  id?: string
  title: string
  heldAt: string
  attendance: number
  opening: string
  attendees: string       // members present
  membersAbsent: string
  membersApology: string
  aob: string
  agenda: string
  minutes: string
  nextMeetingAt: string
  eventId?: string
  status?: 'DRAFT' | 'NOTICE' | 'PENDING_APPROVAL' | 'FINAL'
  publishedDocumentId?: string | null
}

type EventOption = { id: string; title: string; startsAt: string }
type AttendanceStatus = 'PRESENT' | 'APOLOGY' | 'ABSENT'
type MemberOption = { id: string; fullName: string; email?: string | null; phone?: string | null }
export type AttendanceRecord = { userId: string; status: AttendanceStatus }

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  APOLOGY: 'Apology',
  ABSENT: 'Absent',
}

function toLocalInput(isoOrLocal: string) {
  if (!isoOrLocal) return ''
  const d = new Date(isoOrLocal)
  if (Number.isNaN(d.getTime())) return isoOrLocal
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[12px] font-semibold text-on-surface-variant uppercase tracking-wide">
        {label}
        {hint && <span className="ml-1.5 normal-case font-normal text-outline">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT =
  'w-full border border-outline-variant dark:border-[#1e3461] rounded-xl px-3 py-2 text-[13px] bg-surface dark:bg-[#111f36] text-on-surface dark:text-blue-50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors'

export default function MeetingMinutesEditor({
  initial,
  mode,
  events = [],
  members = [],
  initialAttendance = [],
  invitedUserIds = [],
}: {
  initial: MeetingEditorValues
  mode: 'create' | 'edit'
  events?: EventOption[]
  members?: MemberOption[]
  initialAttendance?: AttendanceRecord[]
  invitedUserIds?: string[]
}) {
  const router = useRouter()
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => {
    if (initialAttendance.length) return Object.fromEntries(initialAttendance.map((r) => [r.userId, r.status]))
    return Object.fromEntries(invitedUserIds.map((userId) => [userId, 'PRESENT' as AttendanceStatus]))
  })
  // Records are only saved once the picker is used, so text-only legacy minutes are left alone.
  const [pickerUsed, setPickerUsed] = useState(initialAttendance.length > 0)
  const [memberQuery, setMemberQuery] = useState('')
  const memberName = useMemo(() => new Map(members.map((m) => [m.id, m.fullName])), [members])
  const markedIds = Object.keys(marks).sort((a, b) => (memberName.get(a) || '').localeCompare(memberName.get(b) || ''))
  const namesWith = (status: AttendanceStatus) =>
    markedIds.filter((id) => marks[id] === status).map((id) => memberName.get(id) || 'Member')
  const suggestions = memberQuery.trim()
    ? members
        .filter((m) => {
          const query = memberQuery.trim().toLowerCase()
          return !marks[m.id] && (m.fullName.toLowerCase().includes(query) || (m.email ?? '').toLowerCase().includes(query))
        })
        .slice(0, 8)
    : []
  const updateMarks = (next: Record<string, AttendanceStatus>) => {
    setMarks(next)
    setPickerUsed(true)
  }
  const [values, setValues] = useState({
    ...initial,
    eventId: initial.eventId || '',
    heldAt: toLocalInput(initial.heldAt),
    nextMeetingAt: initial.nextMeetingAt ? toLocalInput(initial.nextMeetingAt) : '',
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const locked = values.status === 'FINAL' || values.status === 'PENDING_APPROVAL'
  // Set after mount so the bound comes from the browser's clock and the attribute
  // matches between the server render and hydration.
  const [minNextMeetingAt, setMinNextMeetingAt] = useState('')
  useEffect(() => {
    setMinNextMeetingAt(lowerBoundFor(nowInputValue(), values.nextMeetingAt || null))
    // Only the value seeded from the record matters; later edits are already bounded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (key: keyof MeetingEditorValues, value: string | number) =>
    setValues((v) => ({ ...v, [key]: value }))

  const previewDate = useMemo(() => {
    try {
      if (!values.heldAt) return '—'
      const d = new Date(values.heldAt)
      return d.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ', ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    } catch { return '—' }
  }, [values.heldAt])

  const extraLines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)
  const computedAttendance = pickerUsed
    ? namesWith('PRESENT').length + extraLines(values.attendees).length
    : values.attendance || 0

  const buildFormData = () => {
    const fd = new FormData()
    if (values.id) fd.set('id', values.id)
    fd.set('title', values.title)
    fd.set('heldAt', values.heldAt)
    fd.set('attendance', String(computedAttendance))
    if (pickerUsed) {
      fd.set('attendanceRecords', JSON.stringify(markedIds.map((userId) => ({ userId, status: marks[userId] }))))
    }
    fd.set('opening', values.opening)
    fd.set('attendees', values.attendees)
    fd.set('membersAbsent', values.membersAbsent)
    fd.set('membersApology', values.membersApology)
    fd.set('aob', values.aob)
    fd.set('agenda', values.agenda)
    fd.set('minutes', values.minutes)
    fd.set('nextMeetingAt', values.nextMeetingAt)
    if (values.eventId) fd.set('eventId', values.eventId)
    return fd
  }

  const onSave = async () => {
    if (locked) {
      setError('Final or pending minutes are locked. Create a revision to edit.')
      return
    }
    setError(''); setMessage(''); setSaving(true)
    try {
      if (mode === 'create') {
        const meeting = await actionCreateMeeting(buildFormData())
        setMessage('Draft saved.')
        router.push(`/dashboard/secretary/meetings/${meeting.id}`)
        router.refresh()
      } else {
        await actionUpdateMeeting(buildFormData())
        setMessage('Draft saved.')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const onPublish = async () => {
    if (!values.id) { setError('Save the draft before publishing.'); return }
    setError(''); setMessage(''); setPublishing(true)
    try {
      await actionUpdateMeeting(buildFormData())
      const approval = new FormData()
      approval.set('meetingId', values.id)
      approval.set('reason', 'Secretary submitted completed minutes for approval')
      await submitMinutesForApproval(approval)
      setValues((v) => ({ ...v, status: 'PENDING_APPROVAL' }))
      setMessage('Submitted for Admin/Executive approval. Publishing to the document repository happens after approval.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const joinNames = (status: AttendanceStatus, text: string) =>
    (pickerUsed ? [...namesWith(status), ...extraLines(text)] : extraLines(text)).join('\n')

  const previewSections = [
    { label: 'Opening', body: values.opening },
    { label: 'Members Present', body: joinNames('PRESENT', values.attendees) },
    { label: 'Absent with Apology', body: joinNames('APOLOGY', values.membersApology) },
    { label: 'Absent', body: joinNames('ABSENT', values.membersAbsent) },
    { label: 'Agenda', body: values.agenda },
    { label: 'Discussion', body: values.minutes },
    { label: 'Any Other Business', body: values.aob },
  ]

  const anyContent = previewSections.some((s) => s.body.trim())

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ── Form ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Link
            href="/dashboard/secretary/meetings"
            className="text-sm text-primary font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            All meetings
          </Link>
          {values.status && (
            <span
              className={`text-[11px] uppercase tracking-wide font-semibold px-2.5 py-1 rounded-full ${
                values.status === 'FINAL'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {values.status}
            </span>
          )}
        </div>

        {locked && (
          <p className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
            {values.status === 'FINAL'
              ? 'Final minutes are locked. Create a revision from Governance management to edit.'
              : 'Minutes are pending approval and cannot be edited until approved or returned to draft.'}
          </p>
        )}

        <div className={`rounded-2xl border border-outline-variant/50 dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 space-y-4 shadow-sm ${locked ? 'opacity-80' : ''}`}>
          {/* Title */}
          <Field label="Title">
            <input
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. January General Meeting"
              className={INPUT}
              required
              disabled={locked}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Date & Time">
              <input
                type="datetime-local"
                value={values.heldAt}
                onChange={(e) => set('heldAt', e.target.value)}
                className={INPUT}
                required
                disabled={locked}
              />
            </Field>
            <Field label="Attendance" hint={pickerUsed ? '(calculated from the list below)' : '(total present)'}>
              <input
                type="number"
                min={0}
                value={computedAttendance}
                onChange={(e) => set('attendance', Number(e.target.value))}
                className={INPUT}
                disabled={locked || pickerUsed}
              />
            </Field>
          </div>

          <Field label="Linked event" hint="(optional)">
            <select
              value={values.eventId || ''}
              onChange={(e) => set('eventId', e.target.value)}
              className={INPUT}
              disabled={locked}
            >
              <option value="">No linked event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} · {new Date(event.startsAt).toLocaleDateString('en-KE')}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Opening">
            <textarea
              value={values.opening}
              onChange={(e) => set('opening', e.target.value)}
              rows={2}
              placeholder="Opening remarks or prayers…"
              className={INPUT}
              disabled={locked}
            />
          </Field>

          {/* Attendance block */}
          <div className="rounded-xl border border-outline-variant/40 dark:border-[#1e3461] bg-surface-container/40 dark:bg-[#0a1628] p-3 space-y-3">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">group</span>
              Attendance
            </p>
            {members.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-on-surface-variant">
                    Pick members from the database{invitedUserIds.length ? ' (invited members are pre-listed)' : ''}.
                  </p>
                  {markedIds.length > 0 && !locked && (
                    <button
                      type="button"
                      onClick={() => updateMarks(Object.fromEntries(markedIds.map((id) => [id, 'PRESENT' as AttendanceStatus])))}
                      className="text-[12px] font-semibold text-primary"
                    >
                      Mark all present
                    </button>
                  )}
                </div>
                {!locked && (
                  <div className="relative">
                    <input
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      placeholder="Search members by name or email…"
                      className={INPUT}
                    />
                    {suggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-outline-variant bg-surface shadow-lg">
                        {suggestions.map((member) => (
                          <li key={member.id}>
                            <button
                              type="button"
                              onClick={() => {
                                updateMarks({ ...marks, [member.id]: 'PRESENT' })
                                setMemberQuery('')
                              }}
                              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-surface-container"
                            >
                              <span className="block">{member.fullName}</span>
                              {(member.email || member.phone) && (
                                <span className="block text-[11px] text-on-surface-variant">{[member.email, member.phone].filter(Boolean).join(' · ')}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {markedIds.length > 0 && (
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {markedIds.map((id) => (
                      <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-2 py-1.5">
                        <span className="text-[13px]">{memberName.get(id) || 'Member'}</span>
                        <div className="flex items-center gap-1">
                          {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={locked}
                              onClick={() => updateMarks({ ...marks, [id]: status })}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                marks[id] === status
                                  ? status === 'PRESENT'
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-secondary-container text-on-primary'
                                  : 'border border-outline-variant text-on-surface-variant'
                              }`}
                            >
                              {STATUS_LABEL[status]}
                            </button>
                          ))}
                          {!locked && (
                            <button
                              type="button"
                              aria-label="Remove"
                              onClick={() => {
                                const next = { ...marks }
                                delete next[id]
                                updateMarks(next)
                              }}
                              className="ml-1 text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[12px] text-on-surface-variant">
                  {namesWith('PRESENT').length} present · {namesWith('APOLOGY').length} apologies ·{' '}
                  {namesWith('ABSENT').length} absent
                </p>
              </div>
            )}
            <Field label="Members Present" hint={members.length ? '(guests or names not in the list — one per line)' : '(one per line)'}>
              <textarea
                value={values.attendees}
                onChange={(e) => set('attendees', e.target.value)}
                rows={3}
                placeholder="Jane Doe&#10;John Smith&#10;…"
                className={INPUT}
                disabled={locked}
              />
            </Field>
            <Field label="Absent with Apology" hint="(one per line)">
              <textarea
                value={values.membersApology}
                onChange={(e) => set('membersApology', e.target.value)}
                rows={2}
                placeholder="Mary Wanjiku&#10;…"
                className={INPUT}
                disabled={locked}
              />
            </Field>
            <Field label="Absent" hint="(no apology — one per line)">
              <textarea
                value={values.membersAbsent}
                onChange={(e) => set('membersAbsent', e.target.value)}
                rows={2}
                placeholder="Peter Otieno&#10;…"
                className={INPUT}
                disabled={locked}
              />
            </Field>
          </div>

          <Field label="Agenda">
            <textarea
              value={values.agenda}
              onChange={(e) => set('agenda', e.target.value)}
              rows={3}
              placeholder="1. Opening prayer&#10;2. Confirmation of previous minutes&#10;3. …"
              className={INPUT}
              disabled={locked}
            />
          </Field>

          <Field label="Discussion / Minutes">
            <textarea
              value={values.minutes}
              onChange={(e) => set('minutes', e.target.value)}
              rows={6}
              placeholder="Record of discussions…"
              className={INPUT}
              disabled={locked}
            />
          </Field>

          <Field label="Any Other Business (AOB)">
            <textarea
              value={values.aob}
              onChange={(e) => set('aob', e.target.value)}
              rows={2}
              placeholder="Additional matters raised…"
              className={INPUT}
              disabled={locked}
            />
          </Field>

          <Field label="Next Meeting">
            <input
              type="datetime-local"
              min={minNextMeetingAt || undefined}
              title="The next meeting cannot be scheduled in the past."
              value={values.nextMeetingAt}
              onChange={(e) => set('nextMeetingAt', e.target.value)}
              className={INPUT}
              disabled={locked}
            />
          </Field>

          {error   && <p className="text-error text-[12px] flex items-center gap-1"><span className="material-symbols-outlined icon-fill text-[14px]">error</span>{error}</p>}
          {message && <p className="text-green-600 dark:text-green-400 text-[12px] flex items-center gap-1"><span className="material-symbols-outlined icon-fill text-[14px]">check_circle</span>{message}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || locked}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">{saving ? 'hourglass_empty' : 'save'}</span>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            {values.id && (
              <>
                <a
                  href={`/api/pdf/minutes/${values.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-outline-variant dark:border-[#1e3461] text-[13px] font-semibold hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  Download PDF
                </a>
                {values.status !== 'FINAL' && values.status !== 'PENDING_APPROVAL' && (
                  <button
                    type="button"
                    onClick={onPublish}
                    disabled={publishing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary-container text-on-primary text-[13px] font-semibold disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">{publishing ? 'hourglass_empty' : 'publish'}</span>
                    {publishing ? 'Submitting…' : 'Submit for approval'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className="lg:sticky lg:top-4 self-start">
        <p className="text-[11px] uppercase tracking-wide text-on-surface-variant font-semibold mb-2 px-1 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">preview</span>
          Letterhead preview
        </p>
        <article className="rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,31,80,0.14)] bg-white border border-outline-variant/30">
          {/* Header */}
          <div className="bg-[#001f50] px-5 py-3.5 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SITE_LOGO}
              alt="Alubonets"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover flex-shrink-0 bg-[#fe8015]/20"
            />
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">Alubonets SHG</p>
              <p className="text-[10px] text-blue-200/70 leading-none mt-0.5">Meeting Minutes</p>
            </div>
          </div>
          {/* Orange stripe */}
          <div className="h-[3px] bg-[#fe8015]" />

          <div className="px-5 py-4 space-y-3 min-h-[420px] text-[13px]">
            {/* Title block */}
            <div className="space-y-1">
              <h2 className="text-[18px] font-bold text-[#001f50] leading-snug">
                {values.title || <span className="text-gray-300 font-normal italic">Untitled meeting</span>}
              </h2>
              <p className="text-[12px] text-gray-500">{previewDate}</p>
              <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-[#001f50]/8 text-[11px] font-semibold text-[#001f50]">
                <span className="material-symbols-outlined text-[12px]">person</span>
                {computedAttendance} present
              </div>
            </div>

            <div className="h-[2px] bg-[#fe8015]/60 rounded-full" />

            {/* Sections */}
            {anyContent ? (
              previewSections.map(
                (s) =>
                  s.body.trim() && (
                    <section key={s.label} className="space-y-0.5">
                      <h3 className="text-[10px] uppercase tracking-wider font-bold text-[#001f50] flex items-center gap-1.5">
                        <span className="inline-block w-[3px] h-[10px] rounded-sm bg-[#fe8015]" />
                        {s.label}
                      </h3>
                      <p className="text-[12px] text-gray-700 whitespace-pre-wrap leading-relaxed pl-[9px]">
                        {s.body}
                      </p>
                    </section>
                  )
              )
            ) : (
              <p className="text-[12px] text-gray-400 italic">
                Start writing on the left — the preview updates live.
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
