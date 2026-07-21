'use client'

import { useState } from 'react'

export type EventRow = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startsAt: string
  imageUrl?: string | null
  isPublic?: boolean
}

type Props = {
  events: EventRow[]
  emptyMessage?: string
  dimPast?: boolean
  selectable?: boolean
  selected?: Set<string>
  onToggleSelect?: (id: string) => void
  onDelete?: (id: string) => void
  onViewDetails?: (event: EventRow) => void
}

export default function EventsGrid({
  events,
  emptyMessage = 'No events.',
  dimPast = false,
  selectable = false,
  selected,
  onToggleSelect,
  onDelete,
  onViewDetails,
}: Props) {
  if (events.length === 0) {
    return <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50 py-2">{emptyMessage}</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {events.map((e) => (
        <EventCard
          key={e.id}
          event={e}
          dimPast={dimPast}
          selectable={selectable}
          isSelected={selected?.has(e.id) ?? false}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(e.id) : undefined}
          onDelete={onDelete ? () => onDelete(e.id) : undefined}
          onViewDetails={onViewDetails ? () => onViewDetails(e) : undefined}
        />
      ))}
    </div>
  )
}

function EventCard({
  event,
  dimPast,
  selectable,
  isSelected,
  onToggleSelect,
  onDelete,
  onViewDetails,
}: {
  event: EventRow
  dimPast: boolean
  selectable: boolean
  isSelected: boolean
  onToggleSelect?: () => void
  onDelete?: () => void
  onViewDetails?: () => void
}) {
  const [showPopover, setShowPopover] = useState(false)
  const date = new Date(event.startsAt)
  const month = date.toLocaleDateString('en-KE', { month: 'short' }).toUpperCase()
  const day = date.getDate()
  const weekday = date.toLocaleDateString('en-KE', { weekday: 'long' })
  const time = date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })

  const daysFromNow = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
  const daysLabel = !dimPast && daysFromNow === 0 ? 'Today'
    : !dimPast && daysFromNow === 1 ? 'Tomorrow'
    : !dimPast && daysFromNow > 0 && daysFromNow <= 30 ? `In ${daysFromNow} days`
    : null

  function confirmAndDelete() {
    setShowPopover(false)
    onDelete?.()
  }

  return (
    <div className={`group rounded-2xl border overflow-hidden flex flex-col bg-surface dark:bg-[#0a1628] transition-all duration-200 shadow-sm hover:shadow-md relative ${
      dimPast ? 'opacity-55' : ''
    } ${
      isSelected
        ? 'border-primary ring-2 ring-primary/20'
        : 'border-outline-variant dark:border-[#1a2d4f] hover:border-primary/40'
    }`}>

      {/* ── Header ── */}
      {event.imageUrl ? (
        <div
          className="relative overflow-hidden cursor-pointer"
          onClick={onViewDetails}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onViewDetails?.()}
        >
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-40 object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="bg-black/40 backdrop-blur-sm text-white text-[12px] font-semibold px-4 py-2 rounded-full border border-white/20 flex items-center gap-1.5">
              View details
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
            </span>
          </div>
          {selectable && (
            <label
              className="absolute top-2.5 left-2.5 flex items-center justify-center w-6 h-6 rounded-lg bg-white/90 dark:bg-[#0a1628]/90 backdrop-blur-sm shadow cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
            </label>
          )}
          {daysLabel && (
            <span className="absolute top-2.5 right-2.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow pointer-events-none">
              {daysLabel}
            </span>
          )}
          {event.isPublic === false && (
            <span className="absolute bottom-2.5 left-2.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full pointer-events-none flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>lock</span>
              Members only
            </span>
          )}
        </div>
      ) : (
        /* No-image gradient header */
        <div className="h-28 bg-gradient-to-br from-primary dark:from-[#1a3a6b] to-[#001f50] dark:to-[#080f20] overflow-hidden relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[90px] font-black leading-none select-none text-white/[0.06] pointer-events-none">
            {day}
          </span>
          <div className="absolute inset-0 flex items-center px-4 gap-3">
            {selectable && (
              <label className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/15 border border-white/20 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelect}
                  className="h-3.5 w-3.5 rounded accent-primary"
                />
              </label>
            )}
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex-shrink-0">
              <span className="text-[9px] font-bold text-on-primary/70 uppercase tracking-[0.15em] leading-none">{month}</span>
              <span className="text-[22px] font-black text-on-primary leading-none mt-0.5">{day}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-on-primary leading-snug line-clamp-2">{event.title}</p>
              {daysLabel && (
                <span className="inline-block mt-1 text-[9px] font-semibold bg-secondary-container/90 text-on-secondary-container px-2 py-0.5 rounded-full">
                  {daysLabel}
                </span>
              )}
            </div>
          </div>
          {event.isPublic === false && (
            <span className="absolute top-2 right-2 bg-black/40 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>lock</span>
              Members only
            </span>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div className="px-4 py-3 flex flex-col gap-1.5 flex-1">
        {/* Title — only for image cards (no-image already has it in header) */}
        {event.imageUrl && (
          <h3 className="text-[13px] font-bold text-on-surface dark:text-blue-50 leading-snug line-clamp-2 mb-0.5">
            {event.title}
          </h3>
        )}

        <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant dark:text-blue-200/60">
          <span className="material-symbols-outlined text-primary dark:text-blue-400 flex-shrink-0" style={{ fontSize: 13 }}>schedule</span>
          <span>{weekday}, {time}</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant dark:text-blue-200/60">
            <span className="material-symbols-outlined text-secondary-container dark:text-orange-400 flex-shrink-0" style={{ fontSize: 13 }}>location_on</span>
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.description && (
          <p className="text-[11px] leading-relaxed text-on-surface-variant/60 dark:text-blue-200/30 line-clamp-2 mt-1 pt-1.5 border-t border-outline-variant/20">
            {event.description}
          </p>
        )}

        {/* View details */}
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:gap-2 transition-all"
          >
            View details
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
          </button>
        )}

        {/* Delete — single button, popover on click */}
        {onDelete && (
          <div className="mt-auto pt-2.5 border-t border-outline-variant/20 flex items-center justify-end relative">
            <button
              type="button"
              onClick={() => setShowPopover((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-outline hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
              Delete
            </button>

            {/* Confirmation popover */}
            {showPopover && (
              <div className="absolute bottom-full right-0 mb-1.5 z-10 w-44 rounded-xl border border-outline-variant shadow-lg bg-surface dark:bg-[#111f36] p-3 flex flex-col gap-2">
                <p className="text-[12px] font-semibold text-on-surface leading-tight">Delete this event?</p>
                <p className="text-[11px] text-on-surface-variant">This cannot be undone.</p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmAndDelete}
                    className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white py-1.5 text-[11px] font-bold transition-colors"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPopover(false)}
                    className="flex-1 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface py-1.5 text-[11px] font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
