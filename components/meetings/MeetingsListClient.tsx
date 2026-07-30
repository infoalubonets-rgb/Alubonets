'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { actionDeleteMeeting, actionDeleteMeetings } from '@/app/actions/meetings'

type Meeting = {
  id: string
  title: string
  heldAt: Date
  attendance: number
  status: 'DRAFT' | 'FINAL'
  publishedDocument: { id: string; fileUrl: string } | null
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

function MeetingCard({
  m,
  isSelected,
  onToggle,
  onDelete,
  confirmingId,
  onConfirmStart,
  onConfirmCancel,
}: {
  m: Meeting
  isSelected: boolean
  onToggle: () => void
  onDelete: (id: string) => void
  confirmingId: string | null
  onConfirmStart: (id: string) => void
  onConfirmCancel: () => void
}) {
  const isDraft = m.status === 'DRAFT'
  const confirming = confirmingId === m.id

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-sm border transition-all ${
      isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
    } ${
      isDraft
        ? 'border-orange-200/80 dark:border-orange-900/40 hover:border-orange-300 dark:hover:border-orange-800/60'
        : 'border-blue-200/70 dark:border-[#1a2d4f] hover:border-blue-300 dark:hover:border-[#1e3461]'
    } bg-white dark:bg-[#0d1729]`}>

      {/* Top gradient band */}
      <div className={`h-[3px] ${
        isDraft
          ? 'bg-gradient-to-r from-[#fe8015] via-[#ffaa55] to-[#fe8015]/60'
          : 'bg-gradient-to-r from-[#001f50] via-[#0a3070] to-[#001f50]/60'
      }`} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="mt-1.5 h-4 w-4 flex-shrink-0 rounded border-outline-variant cursor-pointer accent-primary"
          />

          {/* Date badge */}
          <div className={`flex-shrink-0 w-14 rounded-xl text-center py-2.5 border ${
            isDraft
              ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50'
              : 'bg-[#001f50]/5 dark:bg-[#001f50]/30 border-blue-200 dark:border-[#1a2d4f]'
          }`}>
            <p className={`text-[10px] font-bold leading-none uppercase tracking-wide ${
              isDraft ? 'text-[#fe8015]' : 'text-[#001f50] dark:text-blue-300'
            }`}>
              {m.heldAt.toLocaleDateString('en-KE', { month: 'short' })}
            </p>
            <p className={`text-[23px] font-bold leading-tight ${
              isDraft ? 'text-[#fe8015]' : 'text-[#001f50] dark:text-blue-200'
            }`}>
              {m.heldAt.getDate()}
            </p>
            <p className={`text-[10px] leading-none ${
              isDraft ? 'text-[#fe8015]/60' : 'text-[#001f50]/50 dark:text-blue-400/70'
            }`}>
              {m.heldAt.getFullYear()}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h3 className="text-[15px] font-bold text-[#001f50] dark:text-blue-50 leading-snug">
                {m.title}
              </h3>
              {isDraft ? (
                <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-orange-100 dark:bg-orange-950/50 text-[#fe8015] border border-orange-200 dark:border-orange-800/40">
                  Draft
                </span>
              ) : (
                <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-[#001f50]/10 dark:bg-[#001f50]/40 text-[#001f50] dark:text-blue-300 border border-blue-200 dark:border-[#1a2d4f]">
                  <span className="material-symbols-outlined icon-fill" style={{ fontSize: 10 }}>verified</span>
                  Final
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                {fmtDate(m.heldAt)}
              </span>
              <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {fmtTime(m.heldAt)}
              </span>
              <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]">group</span>
                {m.attendance} present
              </span>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className={`flex items-center flex-wrap gap-2 mt-4 pt-3 border-t ${
          isDraft ? 'border-orange-100 dark:border-orange-900/20' : 'border-blue-100 dark:border-[#1a2d4f]'
        }`}>
          <Link
            href={`/dashboard/secretary/meetings/${m.id}`}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-white hover:opacity-90 active:scale-95 transition-all shadow-sm ${
              isDraft ? 'bg-[#fe8015]' : 'bg-[#001f50] dark:bg-[#0a2a6e]'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">edit_note</span>
            Open editor
          </Link>
          {/* View PDF — finals use stored copy, drafts generate on the fly */}
          <a
            href={m.publishedDocument?.fileUrl ?? `/api/pdf/minutes/${m.id}`}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors ${
              isDraft
                ? 'border-orange-200 dark:border-orange-800/40 text-[#fe8015] hover:bg-orange-50 dark:hover:bg-orange-950/30'
                : 'border-blue-200 dark:border-[#1a2d4f] text-[#001f50] dark:text-blue-300 hover:bg-[#001f50]/5 dark:hover:bg-[#001f50]/20'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
            View PDF
          </a>
          {/* Download PDF */}
          <a
            href={`/api/pdf/minutes/${m.id}?download=1`}
            title="Download PDF"
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-outline-variant/60 dark:border-[#1e3461] text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
          </a>
          {/* Download Word */}
          <a
            href={`/api/export/meetings/docx/${m.id}`}
            title="Download Word (.docx)"
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-outline-variant/60 dark:border-[#1e3461] text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">description</span>
          </a>

          {/* Delete */}
          <div className="ml-auto relative">
            {confirming && (
              <div className="absolute bottom-full right-0 mb-1 z-10 bg-surface border border-outline-variant dark:border-[#1e3461] rounded-xl shadow-xl p-3 w-44">
                <p className="text-[12px] font-semibold text-on-surface mb-2">Delete this meeting?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(m.id)}
                    className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white py-1.5 text-[11px] font-bold transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmCancel}
                    className="flex-1 rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface-container text-on-surface py-1.5 text-[11px] font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => (confirming ? onConfirmCancel() : onConfirmStart(m.id))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MeetingsListClient({ meetings: initial }: { meetings: Meeting[] }) {
  const [items, setItems] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [, startTransition] = useTransition()

  const drafts = items.filter((m) => m.status === 'DRAFT')
  const finals = items.filter((m) => m.status === 'FINAL')

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((m) => m.id)))

  const handleDelete = (id: string) => {
    setConfirmingId(null)
    setItems((prev) => prev.filter((m) => m.id !== id))
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    startTransition(() => actionDeleteMeeting(id))
  }

  const handleBulkDelete = () => {
    const ids = [...selected]
    setConfirmBulk(false)
    setItems((prev) => prev.filter((m) => !ids.includes(m.id)))
    setSelected(new Set())
    startTransition(() => actionDeleteMeetings(ids))
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-orange-200 dark:border-orange-900/40 bg-orange-50/30 dark:bg-orange-950/10 text-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#fe8015]/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-[#fe8015]">groups</span>
        </div>
        <p className="text-[15px] font-bold text-[#001f50] dark:text-blue-100">No meetings yet</p>
        <p className="text-[13px] text-on-surface-variant">Start recording your first meeting minutes.</p>
        <Link
          href="/dashboard/secretary/meetings/new"
          className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#fe8015] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New meeting
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-on-surface-variant max-w-lg leading-relaxed">
          Meetings are stored as text. PDFs are only generated when you download or publish.
        </p>
        <div className="flex gap-2">
          <a
            href="/api/export/meetings/pdf"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-outline-variant dark:border-[#1e3461] text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            Export PDF
          </a>
          <a
            href="/api/export/meetings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-outline-variant dark:border-[#1e3461] text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            Export Word
          </a>
          <Link
            href="/dashboard/secretary/meetings/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#fe8015] text-white text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New meeting
          </Link>
        </div>
      </div>

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#001f50] dark:bg-[#0a1e3d] text-white shadow-lg">
          <span className="text-[13px] font-semibold flex-1">
            {selected.size} meeting{selected.size !== 1 ? 's' : ''} selected
          </span>
          {confirmBulk ? (
            <>
              <span className="text-[12px] text-blue-200">Permanently delete {selected.size} meeting{selected.size !== 1 ? 's' : ''}?</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold transition-colors"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmBulk(false)}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-white text-[12px] font-semibold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmBulk(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-[12px] font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Delete selected
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="p-1.5 rounded-lg hover:bg-white/10 text-blue-200 hover:text-white transition-colors"
                title="Clear selection"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Select-all row */}
      <div className="flex items-center gap-2 px-1">
        <label className="flex items-center gap-2 text-[12px] text-on-surface-variant cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected.size === items.length && items.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-outline-variant cursor-pointer accent-primary"
          />
          Select all ({items.length})
        </label>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#fe8015]" />
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-[#fe8015]">
              Drafts
            </h2>
            <span className="px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-[#fe8015] text-[10px] font-bold">
              {drafts.length}
            </span>
          </div>
          <div className="space-y-3">
            {drafts.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                isSelected={selected.has(m.id)}
                onToggle={() => toggleSelect(m.id)}
                onDelete={handleDelete}
                confirmingId={confirmingId}
                onConfirmStart={(id) => setConfirmingId(id)}
                onConfirmCancel={() => setConfirmingId(null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Published / Finals */}
      {finals.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#001f50] dark:bg-blue-400" />
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-[#001f50] dark:text-blue-300">
              Published
            </h2>
            <span className="px-1.5 py-0.5 rounded-full bg-[#001f50]/10 dark:bg-[#001f50]/40 text-[#001f50] dark:text-blue-300 text-[10px] font-bold">
              {finals.length}
            </span>
          </div>
          <div className="space-y-3">
            {finals.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                isSelected={selected.has(m.id)}
                onToggle={() => toggleSelect(m.id)}
                onDelete={handleDelete}
                confirmingId={confirmingId}
                onConfirmStart={(id) => setConfirmingId(id)}
                onConfirmCancel={() => setConfirmingId(null)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
