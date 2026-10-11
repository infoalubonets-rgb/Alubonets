'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { actionDeleteGalleryPhoto, actionDeleteGalleryPhotos, actionUpdateGalleryPhoto } from '@/app/actions/domain'
import GalleryGrid, { GalleryPhotoRow } from './GalleryGrid'
import CreateGalleryForm from './CreateGalleryForm'
import { GALLERY_FULL_SIZES, gallerySrcSet } from '@/lib/gallery-image'

type Props = { photos: GalleryPhotoRow[] }

export default function OrganizerGalleryClient({ photos }: Props) {
  const [localPhotos, setLocalPhotos] = useState(photos)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [open, setOpen]               = useState(false)
  const [detail, setDetail]           = useState<GalleryPhotoRow | null>(null)
  const [editMode, setEditMode]         = useState(false)
  const [editCaption, setEditCaption]   = useState('')
  const [editCategory, setEditCategory] = useState('')

  useEffect(() => { setLocalPhotos(photos) }, [photos])

  /* ── selection ── */
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function selectAll() { setSelected(new Set(localPhotos.map((p) => p.id))) }
  function clearSelection() { setSelected(new Set()) }
  const anySelected = selected.size > 0

  /* ── delete ── */
  function handleDelete(id: string) {
    setLocalPhotos((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    actionDeleteGalleryPhoto(id).catch(console.error)
  }

  function handleBulkDelete() {
    const ids = [...selected]
    setLocalPhotos((prev) => prev.filter((p) => !ids.includes(p.id)))
    clearSelection()
    actionDeleteGalleryPhotos(ids).catch(console.error)
  }

  /* ── optimistic add ── */
  function handleOptimisticAdd(photo: GalleryPhotoRow) {
    setLocalPhotos((prev) => [photo, ...prev])
    setOpen(false)
  }

  /* ── open detail with edit state reset ── */
  function handleViewDetail(photo: GalleryPhotoRow) {
    setDetail(photo)
    setEditMode(false)
    setEditCaption(photo.caption ?? '')
    setEditCategory(photo.category ?? '')
  }

  /* ── save gallery edit ── */
  function handleSaveEdit() {
    if (!detail) return
    // Optimistic: update UI immediately and close edit mode
    const updated = { ...detail, caption: editCaption || null, category: editCategory || null }
    setLocalPhotos((prev) => prev.map((p) => p.id === detail.id ? updated : p))
    setDetail(updated)
    setEditMode(false)
    // Persist in background
    const fd = new FormData()
    fd.set('id', detail.id)
    fd.set('caption', editCaption)
    fd.set('category', editCategory)
    actionUpdateGalleryPhoto(fd).catch(console.error)
  }

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-bold text-on-surface dark:text-blue-50">Gallery</h1>
          <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
            {localPhotos.length} photo{localPhotos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anySelected && (
            <>
              <span className="text-[12px] text-on-surface-variant dark:text-blue-200/50">{selected.size} selected</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-2 text-[12px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                Delete ({selected.size})
              </button>
              <button type="button" onClick={clearSelection}
                className="text-[12px] text-on-surface-variant dark:text-blue-200/40 hover:text-on-surface transition-colors">
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary text-on-primary px-4 py-2 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined icon-fill" style={{ fontSize: 17 }}>add_photo_alternate</span>
            Add photo
          </button>
        </div>
      </div>

      {/* Select all / deselect all */}
      {localPhotos.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={anySelected && selected.size === localPhotos.length ? clearSelection : selectAll}
            className="text-[11px] text-on-surface-variant dark:text-blue-200/40 hover:text-primary dark:hover:text-blue-300 transition-colors"
          >
            {anySelected && selected.size === localPhotos.length ? 'Deselect all' : 'Select all'}
          </button>
          {anySelected && (
            <span className="text-[11px] text-on-surface-variant dark:text-blue-200/30">·</span>
          )}
        </div>
      )}

      {/* Grid */}
      <GalleryGrid
        photos={localPhotos}
        emptyMessage="No photos yet. Add your first photo with the button above."
        selectable
        selected={selected}
        onToggleSelect={toggleSelect}
        onDelete={handleDelete}
        onViewDetails={handleViewDetail}
      />

      {/* Add photo modal */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>add_photo_alternate</span>
                </div>
                <div>
                  <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Add photo</h2>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50">Upload or paste an image URL</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-surface-container dark:hover:bg-[#111f36] text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <CreateGalleryForm onOptimisticAdd={handleOptimisticAdd} />
          </div>
        </div>,
        document.body
      )}

      {/* View details modal */}
      {detail && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="relative w-full max-w-lg bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl border border-outline-variant dark:border-[#1a2d4f] overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="relative flex-shrink-0 max-h-72 overflow-hidden bg-black">
              <img src={detail.url} srcSet={gallerySrcSet(detail.url)} sizes={GALLERY_FULL_SIZES} alt={detail.caption || 'Photo'} className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Details / Edit */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {editMode ? (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Caption</label>
                      <input
                        autoFocus
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        placeholder="e.g. Annual general meeting"
                        className="w-full rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 text-[13px] text-on-surface dark:text-blue-50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Category</label>
                      <div className="relative rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full appearance-none bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 px-3 py-2.5 pr-8 cursor-pointer"
                        >
                          <option value="">No category</option>
                          {['Events','Meetings','Projects','Celebrations','Community Work','Fundraising','Training','Field Visit','Members','Other'].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline" style={{ fontSize: 16 }}>expand_more</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[16px] font-bold text-on-surface dark:text-blue-50 leading-snug">
                      {detail.caption || <span className="text-on-surface-variant italic font-normal">No caption</span>}
                    </h2>
                    <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      detail.isPublic
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-surface-container dark:bg-[#1a2d4f] text-on-surface-variant dark:text-blue-200/50'
                    }`}>
                      {detail.isPublic ? 'Public' : 'Pending'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {detail.category && (
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 18 }}>label</span>
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</p>
                          <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">{detail.category}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 18 }}>calendar_month</span>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Uploaded</p>
                        <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">
                          {new Date(detail.uploadedAt).toLocaleDateString('en-KE', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-outline-variant/30 dark:border-[#1a2d4f] flex gap-2 flex-shrink-0">
              {editMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="flex-1 rounded-xl border border-outline-variant dark:border-[#1a2d4f] bg-surface-container dark:bg-[#111f36] hover:bg-surface-container-high py-2.5 text-[13px] font-semibold text-on-surface dark:text-blue-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary hover:opacity-90 py-2.5 text-[13px] font-semibold transition-opacity"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
                    Save changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="flex-1 rounded-xl border border-outline-variant dark:border-[#1a2d4f] bg-surface-container dark:bg-[#111f36] hover:bg-surface-container-high py-2.5 text-[13px] font-semibold text-on-surface dark:text-blue-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary hover:opacity-90 py-2.5 text-[13px] font-semibold transition-opacity"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                    Edit photo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
