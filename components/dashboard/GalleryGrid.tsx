'use client'

import { useState } from 'react'
import { GALLERY_GRID_SIZES, gallerySrcSet } from '@/lib/gallery-image'

export type GalleryPhotoRow = {
  id: string
  url: string
  caption?: string | null
  category?: string | null
  isPublic: boolean
  uploadedAt: string
}

type Props = {
  photos: GalleryPhotoRow[]
  emptyMessage?: string
  selectable?: boolean
  selected?: Set<string>
  onToggleSelect?: (id: string) => void
  onDelete?: (id: string) => void
  onViewDetails?: (photo: GalleryPhotoRow) => void
}

export default function GalleryGrid({
  photos,
  emptyMessage = 'No photos yet.',
  selectable = false,
  selected,
  onToggleSelect,
  onDelete,
  onViewDetails,
}: Props) {
  if (photos.length === 0) {
    return <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50 py-2">{emptyMessage}</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {photos.map((photo) => (
        <GalleryCard
          key={photo.id}
          photo={photo}
          selectable={selectable}
          isSelected={selected?.has(photo.id) ?? false}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(photo.id) : undefined}
          onDelete={onDelete ? () => onDelete(photo.id) : undefined}
          onViewDetails={onViewDetails ? () => onViewDetails(photo) : undefined}
        />
      ))}
    </div>
  )
}

function GalleryCard({
  photo,
  selectable,
  isSelected,
  onToggleSelect,
  onDelete,
  onViewDetails,
}: {
  photo: GalleryPhotoRow
  selectable: boolean
  isSelected: boolean
  onToggleSelect?: () => void
  onDelete?: () => void
  onViewDetails?: () => void
}) {
  const [showPopover, setShowPopover] = useState(false)
  const date = new Date(photo.uploadedAt)
  const dateStr = date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className={`group relative rounded-2xl overflow-hidden border bg-surface dark:bg-[#0a1628] transition-all duration-200 shadow-sm hover:shadow-md ${
      isSelected
        ? 'border-primary ring-2 ring-primary/20'
        : 'border-outline-variant dark:border-[#1a2d4f] hover:border-primary/40'
    }`}>

      {/* Image */}
      <div
        className="relative aspect-square cursor-pointer overflow-hidden bg-surface-container-low dark:bg-[#071426]"
        onClick={onViewDetails}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onViewDetails?.()}
      >
        <img
          src={photo.url}
          srcSet={gallerySrcSet(photo.url)}
          sizes={GALLERY_GRID_SIZES}
          alt={photo.caption || 'Gallery photo'}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm text-white text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5">
            View details
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
          </span>
        </div>

        {/* Checkbox */}
        {selectable && (
          <label
            className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-lg bg-white/90 dark:bg-[#0a1628]/90 backdrop-blur-sm shadow cursor-pointer z-10"
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

        {/* Public/Pending badge */}
        <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full pointer-events-none ${
          photo.isPublic
            ? 'bg-green-500/90 text-white'
            : 'bg-black/50 backdrop-blur-sm text-white/80'
        }`}>
          {photo.isPublic ? 'Public' : 'Pending'}
        </span>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex flex-col gap-1">
        <p className="text-[12px] font-semibold text-on-surface dark:text-blue-50 leading-snug line-clamp-1">
          {photo.caption || <span className="text-on-surface-variant dark:text-blue-200/40 italic">No caption</span>}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            {photo.category && (
              <span className="text-[10px] text-on-surface-variant dark:text-blue-200/50 bg-surface-container dark:bg-[#111f36] px-1.5 py-0.5 rounded-md truncate">
                {photo.category}
              </span>
            )}
            <span className="text-[10px] text-on-surface-variant/50 dark:text-blue-200/30 truncate">{dateStr}</span>
          </div>

          {/* Delete */}
          {onDelete && (
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowPopover((v) => !v)}
                className="text-outline hover:text-red-500 transition-colors p-0.5 rounded"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
              </button>
              {showPopover && (
                <div className="absolute bottom-full right-0 mb-1.5 z-10 w-40 rounded-xl border border-outline-variant shadow-lg bg-surface dark:bg-[#111f36] p-3 flex flex-col gap-2">
                  <p className="text-[11px] font-semibold text-on-surface leading-tight">Delete this photo?</p>
                  <p className="text-[10px] text-on-surface-variant">This cannot be undone.</p>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setShowPopover(false); onDelete() }}
                      className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white py-1.5 text-[11px] font-bold transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPopover(false)}
                      className="flex-1 rounded-lg border border-outline-variant bg-surface-container text-on-surface py-1.5 text-[11px] font-semibold transition-colors"
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
    </div>
  )
}
