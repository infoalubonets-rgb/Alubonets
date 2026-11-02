'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import CreateGalleryForm from './CreateGalleryForm'
import type { GalleryPhotoRow } from './GalleryGrid'

/** Event fired with the new photos as `detail`, so any gallery list on the page can show them at once. */
export const GALLERY_PHOTO_ADDED = 'gallery-photo-added'

/** "Add photos" button with its upload modal — usable in a page header or as a DashboardShell pageAction. */
export default function AddGalleryPhotoButton() {
  const [open, setOpen] = useState(false)

  function handleAdded(photos: GalleryPhotoRow[]) {
    window.dispatchEvent(new CustomEvent<GalleryPhotoRow[]>(GALLERY_PHOTO_ADDED, { detail: photos }))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary text-on-primary px-4 py-2 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
      >
        <span className="material-symbols-outlined icon-fill" style={{ fontSize: 17 }}>add_photo_alternate</span>
        Add photos
      </button>

      {/* No close on backdrop click: a stray click would throw away a batch mid-upload. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>add_photo_alternate</span>
                </div>
                <div>
                  <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Add photos</h2>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50">One photo, many at once, or a ZIP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 hover:bg-surface-container dark:hover:bg-[#111f36] text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <CreateGalleryForm onAdded={handleAdded} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
