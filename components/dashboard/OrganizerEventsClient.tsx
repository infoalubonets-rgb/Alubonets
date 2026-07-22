'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { actionDeleteEvent, actionDeleteEvents } from '@/app/actions/domain'
import CreateEventForm from './CreateEventForm'
import EventsGrid, { EventRow } from './EventsGrid'

type MemberOption = { id: string; fullName: string; email: string }

type Props = {
  upcoming: EventRow[]
  past: EventRow[]
  members: MemberOption[]
}

export default function OrganizerEventsClient({ upcoming, past, members }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [detail, setDetail] = useState<EventRow | null>(null)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [localUpcoming, setLocalUpcoming] = useState(upcoming)
  const [localPast, setLocalPast] = useState(past)

  // Sync when server refreshes props (after background save completes)
  useEffect(() => { setLocalUpcoming(upcoming) }, [upcoming])
  useEffect(() => { setLocalPast(past) }, [past])

  function handleOptimisticAdd(event: EventRow) {
    setLocalUpcoming((prev) => [event, ...prev])
    setOpen(false)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll(events: EventRow[]) {
    setSelected(new Set(events.map((e) => e.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function handleDelete(id: string) {
    setLocalUpcoming((prev) => prev.filter((e) => e.id !== id))
    setLocalPast((prev) => prev.filter((e) => e.id !== id))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    if (!id.startsWith('opt-')) startTransition(() => { actionDeleteEvent(id) })
  }

  function handleOptimisticUpdate(updated: EventRow) {
    setEditing(null)
    setLocalUpcoming((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    setLocalPast((prev) => prev.map((e) => e.id === updated.id ? updated : e))
  }

  function handleBulkDelete() {
    const ids = [...selected]
    setLocalUpcoming((prev) => prev.filter((e) => !ids.includes(e.id)))
    setLocalPast((prev) => prev.filter((e) => !ids.includes(e.id)))
    clearSelection()
    const realIds = ids.filter((id) => !id.startsWith('opt-'))
    if (realIds.length > 0) startTransition(() => { actionDeleteEvents(realIds) })
  }

  function handleDeleteAllPast() {
    const ids = localPast.map((e) => e.id)
    setLocalPast([])
    clearSelection()
    startTransition(() => { actionDeleteEvents(ids) })
  }

  const anySelected = selected.size > 0

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">

      {/* Past events cleanup banner */}
      {localPast.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 flex-shrink-0" style={{ fontSize: 18 }}>
              schedule
            </span>
            <p className="text-[12px] text-amber-800 dark:text-amber-300 truncate">
              {localPast.length} past event{localPast.length > 1 ? 's' : ''} — consider cleaning up old records
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleDeleteAllPast}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete_sweep</span>
            Delete all past
          </button>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-bold text-on-surface dark:text-blue-50">Events</h1>
          <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
            {localUpcoming.length} upcoming · {localPast.length} past
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anySelected && (
            <>
              <span className="text-[12px] text-on-surface-variant dark:text-blue-200/50">
                {selected.size} selected
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-2 text-[12px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                Delete ({selected.size})
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[12px] text-on-surface-variant dark:text-blue-200/40 hover:text-on-surface dark:hover:text-blue-200 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary text-on-primary px-4 py-2 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined icon-fill" style={{ fontSize: 17 }}>add_circle</span>
            Add new event
          </button>
        </div>
      </div>

      {/* Upcoming */}
      <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>event_upcoming</span>
            <h2 className="font-semibold text-[13px] text-on-surface dark:text-blue-50 uppercase tracking-wider">
              Upcoming ({localUpcoming.length})
            </h2>
          </div>
          {localUpcoming.length > 0 && (
            <button
              type="button"
              onClick={() => selected.size === localUpcoming.length ? clearSelection() : selectAll(localUpcoming)}
              className="text-[11px] text-on-surface-variant dark:text-blue-200/40 hover:text-primary dark:hover:text-blue-300 transition-colors"
            >
              {localUpcoming.length > 0 && localUpcoming.every(e => selected.has(e.id)) ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <EventsGrid
          events={localUpcoming}
          emptyMessage="No upcoming events yet. Add one with the button above."
          selectable
          selected={selected}
          onToggleSelect={toggleSelect}
          onDelete={handleDelete}
          onViewDetails={setDetail}
        />
      </section>

      {/* Past */}
      {localPast.length > 0 && (
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 18 }}>history</span>
              <h2 className="font-semibold text-[13px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                Past ({localPast.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => localPast.every(e => selected.has(e.id)) ? clearSelection() : selectAll(localPast)}
              className="text-[11px] text-on-surface-variant dark:text-blue-200/40 hover:text-primary dark:hover:text-blue-300 transition-colors"
            >
              {localPast.every(e => selected.has(e.id)) ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <EventsGrid
            events={localPast.slice(0, 12)}
            emptyMessage=""
            dimPast
            selectable
            selected={selected}
            onToggleSelect={toggleSelect}
            onDelete={handleDelete}
            onViewDetails={setDetail}
          />
        </section>
      )}

      {/* Event detail modal */}
      {detail && (() => {
        const d = new Date(detail.startsAt)
        const dateStr = d.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const timeStr = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
        return createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDetail(null)}
          >
            <div
              className="relative w-full max-w-lg bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl border border-outline-variant dark:border-[#1a2d4f] overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image header or gradient */}
              {detail.imageUrl ? (
                <div className="relative h-52 flex-shrink-0 overflow-hidden">
                  <img src={detail.imageUrl} alt={detail.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                  </button>
                </div>
              ) : (
                <div className="relative h-32 bg-gradient-to-br from-primary to-[#001f50] overflow-hidden flex-shrink-0">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[100px] font-black text-white/[0.06] leading-none select-none pointer-events-none">
                    {d.getDate()}
                  </span>
                  <div className="absolute inset-0 flex items-center px-5 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-on-primary/60 uppercase tracking-[0.15em] leading-none">
                        {d.toLocaleDateString('en-KE', { month: 'short' }).toUpperCase()}
                      </span>
                      <span className="text-[28px] font-black text-on-primary leading-none">{d.getDate()}</span>
                    </div>
                    <h2 className="text-[18px] font-black text-on-primary leading-snug line-clamp-2">{detail.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {detail.imageUrl && (
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[18px] font-bold text-on-surface dark:text-blue-50 leading-snug">{detail.title}</h2>
                    {detail.isPublic === false && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-outline/10 text-outline px-2 py-0.5 rounded-full mt-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>lock</span>
                        Members only
                      </span>
                    )}
                  </div>
                )}
                {!detail.imageUrl && detail.isPublic === false && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-outline/10 text-outline px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined" style={{ fontSize: 10 }}>lock</span>
                    Members only
                  </span>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary flex-shrink-0 mt-0.5" style={{ fontSize: 18 }}>calendar_month</span>
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Date & time</p>
                      <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">{dateStr}</p>
                      <p className="text-[13px] text-on-surface-variant">{timeStr}</p>
                    </div>
                  </div>
                  {detail.location && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary-container flex-shrink-0 mt-0.5" style={{ fontSize: 18 }}>location_on</span>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Location</p>
                        <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">{detail.location}</p>
                      </div>
                    </div>
                  )}
                </div>

                {detail.description && (
                  <div className="pt-3 border-t border-outline-variant/30 dark:border-[#1a2d4f]">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Description</p>
                    <p className="text-[14px] text-on-surface-variant dark:text-blue-200/60 leading-relaxed whitespace-pre-wrap">
                      {detail.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-2 p-4 border-t border-outline-variant/30 dark:border-[#1a2d4f] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="flex-1 rounded-xl border border-outline-variant dark:border-[#1a2d4f] bg-surface-container dark:bg-[#111f36] hover:bg-surface-container-high py-2.5 text-[13px] font-semibold text-on-surface dark:text-blue-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(detail); setDetail(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary hover:opacity-90 py-2.5 text-[13px] font-semibold transition-opacity"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                  Edit event
                </button>
              </div>
            </div>
          </div>
        , document.body)
      })()}

      {/* Edit event modal */}
      {editing && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>edit</span>
                </div>
                <div>
                  <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Edit event</h2>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 truncate max-w-[200px]">{editing.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full p-1.5 hover:bg-surface-container dark:hover:bg-[#111f36] text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <CreateEventForm
              key={editing.id}
              initial={editing}
              onSuccess={handleOptimisticUpdate}
              members={members}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Create event modal */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>add_circle</span>
                </div>
                <div>
                  <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Create event</h2>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50">
                    Add a cover photo and choose who sees it
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-surface-container dark:hover:bg-[#111f36] text-on-surface-variant dark:text-blue-200/60 transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <CreateEventForm onOptimisticAdd={handleOptimisticAdd} members={members} />
          </div>
        </div>
      , document.body)}
    </div>
  )
}
