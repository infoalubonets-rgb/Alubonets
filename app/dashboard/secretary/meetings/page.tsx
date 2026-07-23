import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

export default async function SecretaryMeetingsPage() {
  const meetings = await prisma.meeting.findMany({
    orderBy: { heldAt: 'desc' },
    include: { publishedDocument: { select: { id: true, fileUrl: true } } },
  })

  const drafts = meetings.filter((m) => m.status === 'DRAFT')
  const finals = meetings.filter((m) => m.status === 'FINAL')

  return (
    <DashboardShell role="SECRETARY" title="Meetings" nav={SECRETARY_NAV}>
      <div className="space-y-6">

        {/* ── Top bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-on-surface-variant max-w-lg leading-relaxed">
            Draft minutes as structured text, preview the letterhead, download a PDF, and publish a
            Final copy to the documents library.
          </p>
          <div className="flex gap-2">
            <a
              href="/api/export/meetings"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant dark:border-[#1e3461] text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export DOCX
            </a>
            <Link
              href="/dashboard/secretary/meetings/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New meeting
            </Link>
          </div>
        </div>

        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container/30 text-center gap-3">
            <span className="material-symbols-outlined text-[40px] text-outline">groups</span>
            <p className="text-on-surface-variant text-[14px]">No meetings yet.</p>
            <Link
              href="/dashboard/secretary/meetings/new"
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-[13px] font-semibold"
            >
              Record first meeting
            </Link>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Drafts ── */}
            {drafts.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-outline" />
                  Drafts ({drafts.length})
                </h2>
                <div className="rounded-2xl border border-outline-variant/40 dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] overflow-hidden divide-y divide-outline-variant/30 dark:divide-[#1a2d4f]">
                  {drafts.map((m) => (
                    <MeetingRow key={m.id} m={m} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Finals ── */}
            {finals.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                  Published ({finals.length})
                </h2>
                <div className="rounded-2xl border border-outline-variant/40 dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] overflow-hidden divide-y divide-outline-variant/30 dark:divide-[#1a2d4f]">
                  {finals.map((m) => (
                    <MeetingRow key={m.id} m={m} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

function MeetingRow({
  m,
}: {
  m: {
    id: string
    title: string
    heldAt: Date
    location: string | null
    attendance: number
    status: 'DRAFT' | 'FINAL'
    publishedDocument: { id: string; fileUrl: string } | null
  }
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-surface-container/40 dark:hover:bg-[#111f36]/60 transition-colors group">
      {/* Left: date badge + info */}
      <div className="flex items-start gap-3 min-w-0">
        {/* Date badge */}
        <div className="flex-shrink-0 w-12 rounded-lg bg-primary/8 dark:bg-primary/15 text-center py-1.5">
          <p className="text-[11px] font-bold text-primary leading-none">
            {m.heldAt.toLocaleDateString('en-KE', { month: 'short' }).toUpperCase()}
          </p>
          <p className="text-[18px] font-bold text-primary leading-tight">
            {m.heldAt.getDate()}
          </p>
          <p className="text-[10px] text-on-surface-variant leading-none">
            {m.heldAt.getFullYear()}
          </p>
        </div>

        {/* Title + meta */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[14px] text-on-surface dark:text-blue-50 truncate">
              {m.title}
            </p>
            {m.status === 'FINAL' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined icon-fill text-[11px]">verified</span>
                Final
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              {fmtTime(m.heldAt)}
            </span>
            {m.location && (
              <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">location_on</span>
                {m.location}
              </span>
            )}
            <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">group</span>
              {m.attendance} present
            </span>
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Link
          href={`/dashboard/secretary/meetings/${m.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-primary hover:bg-primary/8 dark:hover:bg-primary/15 transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">edit_note</span>
          Open
        </Link>
        <a
          href={`/api/pdf/minutes/${m.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
          PDF
        </a>
        {m.publishedDocument?.fileUrl && (
          <a
            href={m.publishedDocument.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">library_books</span>
            Library
          </a>
        )}
      </div>
    </div>
  )
}
