'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { actionCreateGalleryPhotos } from '@/app/actions/domain'
import type { GalleryPhotoRow } from './GalleryGrid'
import {
  GALLERY_MAX_BATCH,
  GALLERY_MAX_PHOTO_BYTES,
  GALLERY_MAX_ZIP_BYTES,
  GALLERY_UPLOAD_CONCURRENCY,
  extractZipImages,
  isSupportedImage,
  isZip,
  shrinkForUpload,
  uploadGalleryPhoto,
} from '@/lib/gallery-upload'

export const GALLERY_CATEGORIES = [
  'Events',
  'Meetings',
  'Projects',
  'Celebrations',
  'Community Work',
  'Fundraising',
  'Training',
  'Field Visit',
  'Members',
  'Other',
]

type Item = {
  key: string
  name: string
  preview: string
  file?: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  progress: number
  url?: string
  error?: string
  caption: string
}

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`
let keySeq = 0
const nextKey = () => `item-${Date.now()}-${keySeq++}`

/**
 * Add one photo or a whole batch: pick several files, drop them in, or choose a ZIP. Each photo
 * starts uploading as soon as it is added (a few at a time, shrunk in the browser first), and
 * the batch is saved in one go. Captions are optional — add them here or later with Edit photo.
 */
export default function CreateGalleryForm({ onAdded }: { onAdded?: (photos: GalleryPhotoRow[]) => void }) {
  const [items, setItems]           = useState<Item[]>([])
  const [category, setCategory]     = useState('')
  const [captionAll, setCaptionAll] = useState('')
  const [pastedUrl, setPastedUrl]   = useState('')
  const [notice, setNotice]         = useState('')
  const [unzipping, setUnzipping]   = useState(false)
  const [dragging, setDragging]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')

  const photoRef = useRef<HTMLInputElement>(null)
  const zipRef   = useRef<HTMLInputElement>(null)
  const active   = useRef(0)
  const queue    = useRef<Item[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => () => itemsRef.current.forEach((item) => item.file && URL.revokeObjectURL(item.preview)), [])

  const patch = useCallback((key: string, change: Partial<Item>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }, [])

  const pump = useCallback(() => {
    while (active.current < GALLERY_UPLOAD_CONCURRENCY && queue.current.length) {
      const item = queue.current.shift()!
      if (!itemsRef.current.some((i) => i.key === item.key)) continue
      active.current++
      patch(item.key, { status: 'uploading', progress: 1, error: undefined })
      shrinkForUpload(item.file!)
        .then((file) => uploadGalleryPhoto(file, (progress) => patch(item.key, { progress })))
        .then((result) => patch(item.key, { status: 'done', progress: 100, url: result.url }))
        .catch((err: unknown) => patch(item.key, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }))
        .finally(() => { active.current--; pump() })
    }
  }, [patch])

  async function addFiles(list: FileList | File[]) {
    setNotice(''); setSaveError('')
    const files = [...list]
    const images: File[] = []
    const problems: string[] = []
    let skipped = 0

    for (const file of files) {
      if (isZip(file)) {
        if (file.size > GALLERY_MAX_ZIP_BYTES) { problems.push(`${file.name} is over ${mb(GALLERY_MAX_ZIP_BYTES)}`); continue }
        setUnzipping(true)
        try {
          const result = await extractZipImages(file)
          images.push(...result.images)
          skipped += result.skipped
        } catch {
          problems.push(`${file.name} could not be opened as a ZIP`)
        } finally {
          setUnzipping(false)
        }
      } else if (isSupportedImage(file)) {
        images.push(file)
      } else {
        skipped++
      }
    }

    const tooBig = images.filter((f) => f.size > GALLERY_MAX_PHOTO_BYTES)
    if (tooBig.length) problems.push(`${tooBig.length} photo${tooBig.length > 1 ? 's are' : ' is'} over ${mb(GALLERY_MAX_PHOTO_BYTES)}`)
    let accepted = images.filter((f) => f.size <= GALLERY_MAX_PHOTO_BYTES && f.size > 0)

    const room = GALLERY_MAX_BATCH - itemsRef.current.length
    if (accepted.length > room) {
      problems.push(`only ${GALLERY_MAX_BATCH} photos fit in one batch — ${accepted.length - room} left out, add them in the next batch`)
      accepted = accepted.slice(0, Math.max(0, room))
    }
    if (skipped) problems.push(`${skipped} file${skipped > 1 ? 's' : ''} skipped (not JPG, PNG, WebP or GIF)`)
    if (problems.length) setNotice(problems.join(' · '))

    const fresh: Item[] = accepted.map((file) => ({
      key: nextKey(), name: file.name, preview: URL.createObjectURL(file), file,
      status: 'queued', progress: 0, caption: '',
    }))
    if (!fresh.length) return
    setItems((prev) => [...prev, ...fresh])
    itemsRef.current = [...itemsRef.current, ...fresh]
    queue.current.push(...fresh)
    pump()
  }

  function addPastedUrl() {
    const url = pastedUrl.trim()
    if (!/^https?:\/\//i.test(url) || items.length >= GALLERY_MAX_BATCH) return
    setItems((prev) => [...prev, { key: nextKey(), name: url, preview: url, status: 'done', progress: 100, url, caption: '' }])
    setPastedUrl('')
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key)
    if (item?.file) URL.revokeObjectURL(item.preview)
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function retry(key: string) {
    const item = items.find((i) => i.key === key)
    if (!item?.file) return
    patch(key, { status: 'queued', progress: 0, error: undefined })
    queue.current.push(item)
    pump()
  }

  function clearFailed() {
    items.filter((i) => i.status === 'error').forEach((i) => remove(i.key))
  }

  const done      = items.filter((i) => i.status === 'done')
  const failed    = items.filter((i) => i.status === 'error').length
  const pending   = items.length - done.length - failed
  const busy      = pending > 0 || unzipping
  const overall   = items.length ? Math.round(items.reduce((sum, i) => sum + (i.status === 'error' ? 100 : i.progress), 0) / items.length) : 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!done.length || busy || saving) return
    setSaving(true); setSaveError('')
    try {
      const created = await actionCreateGalleryPhotos(done.map((item) => ({
        url: item.url!,
        caption: item.caption.trim() || captionAll.trim() || null,
        category: category || null,
      })))
      done.forEach((item) => item.file && URL.revokeObjectURL(item.preview))
      setItems((prev) => prev.filter((i) => i.status !== 'done'))
      onAdded?.(created)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the photos')
    } finally {
      setSaving(false)
    }
  }

  const inputBox = 'rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all'
  const label = 'block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input ref={photoRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = '' }} />
      <input ref={zipRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden"
        onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = '' }} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files) }}
        className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-outline-variant dark:border-[#1e3461]'
        }`}
      >
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>
          {unzipping ? 'folder_zip' : 'cloud_upload'}
        </span>
        <p className="mt-1 text-[13px] font-semibold text-on-surface dark:text-blue-50">
          {unzipping ? 'Opening ZIP…' : 'Drop photos or a ZIP here'}
        </p>
        <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50">
          Up to {GALLERY_MAX_BATCH} photos per batch · {mb(GALLERY_MAX_PHOTO_BYTES)} each · ZIP up to {mb(GALLERY_MAX_ZIP_BYTES)}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => photoRef.current?.click()} disabled={unzipping}
            className="flex items-center gap-1.5 rounded-xl bg-primary text-on-primary px-3 py-2 text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>photo_library</span>
            Choose photos
          </button>
          <button type="button" onClick={() => zipRef.current?.click()} disabled={unzipping}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2 text-[12px] font-medium text-on-surface dark:text-blue-200 hover:border-primary/40 transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>folder_zip</span>
            Upload ZIP
          </button>
        </div>
      </div>

      {/* Paste a link */}
      <div className={`flex items-center gap-2 px-3 py-2 ${inputBox}`}>
        <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 14 }}>link</span>
        <input
          type="url" placeholder="or paste an image URL and press Enter…"
          value={pastedUrl}
          onChange={(e) => setPastedUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPastedUrl() } }}
          className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
        />
        {pastedUrl && (
          <button type="button" onClick={addPastedUrl} className="text-[12px] font-semibold text-primary">Add</button>
        )}
      </div>

      {notice && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 13 }}>info</span>
          {notice}
        </p>
      )}

      {/* Queue */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-on-surface-variant dark:text-blue-200/50">
            <span className="flex items-center gap-1">
              {busy && <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
              {done.length} of {items.length} uploaded{failed ? ` · ${failed} failed` : ''}
            </span>
            {failed > 0 && (
              <button type="button" onClick={clearFailed} className="font-semibold text-red-500 hover:underline">Remove failed</button>
            )}
          </div>
          {busy && (
            <div className="h-1.5 w-full rounded-full bg-surface-container dark:bg-[#1a2d4f] overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${overall}%` }} />
            </div>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[38vh] overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] p-1.5">
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-surface-container dark:bg-[#071426]">
                  <img src={item.preview} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  {item.status !== 'done' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-[10px] font-bold">
                      {item.status === 'error'
                        ? <span className="material-symbols-outlined text-red-300" style={{ fontSize: 18 }}>error</span>
                        : item.status === 'queued' ? 'Waiting' : `${item.progress}%`}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {item.status === 'error' ? (
                    <p className="text-[11px] text-red-500 line-clamp-2">
                      {item.error}{' '}
                      {item.file && <button type="button" onClick={() => retry(item.key)} className="font-semibold underline">Retry</button>}
                    </p>
                  ) : (
                    <input
                      value={item.caption}
                      onChange={(e) => patch(item.key, { caption: e.target.value })}
                      placeholder={captionAll || 'Caption (optional)'}
                      className="w-full rounded-lg bg-surface-container dark:bg-[#111f36] px-2 py-1.5 text-[12px] text-on-surface dark:text-blue-50 outline-none focus:ring-1 focus:ring-primary placeholder:text-outline dark:placeholder:text-blue-200/30"
                    />
                  )}
                  <p className="truncate text-[10px] text-on-surface-variant dark:text-blue-200/40">{item.name}</p>
                </div>
                <button type="button" onClick={() => remove(item.key)} aria-label="Remove"
                  className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={label}>{items.length > 1 ? 'Caption for all' : 'Caption'}</label>
          <div className={`flex items-center gap-2 px-3 py-2.5 ${inputBox}`}>
            <input
              placeholder="Optional — e.g. Annual general meeting"
              value={captionAll} onChange={(e) => setCaptionAll(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className={label}>Category</label>
          <div className={`relative ${inputBox}`}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 px-3 py-2.5 pr-8 cursor-pointer"
            >
              <option value="">Select category…</option>
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>
              expand_more
            </span>
          </div>
        </div>
      </div>
      {items.length > 1 && (
        <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50">
          Captions are optional. A photo&apos;s own caption wins over the one for all; you can also add or change captions later with Edit photo.
        </p>
      )}

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <span className="material-symbols-outlined text-green-600 dark:text-green-400 flex-shrink-0" style={{ fontSize: 15 }}>public</span>
        <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
          Published to public gallery · Members get one notification for the batch
        </p>
      </div>

      {saveError && (
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
          {saveError}
        </p>
      )}

      <button
        type="submit"
        disabled={!done.length || busy || saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
      >
        <span className={`material-symbols-outlined ${saving || busy ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>
          {saving || busy ? 'progress_activity' : 'add_photo_alternate'}
        </span>
        {saving ? 'Saving…'
          : busy ? `Uploading ${done.length}/${items.length}…`
          : done.length > 1 ? `Add ${done.length} photos` : 'Add photo'}
      </button>
    </form>
  )
}
