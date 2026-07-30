'use client'

import { useRef, useState } from 'react'
import { actionCreateGallery } from '@/app/actions/domain'
import { createClient } from '@/utils/supabase/client'

const MAX_PX    = 1200
const MAX_BYTES = 3 * 1024 * 1024

const GALLERY_CATEGORIES = [
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

type OptimisticPhoto = {
  id: string; url: string; caption?: string | null
  category?: string | null; isPublic: boolean; uploadedAt: string
}

function toBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', q),
  )
}

async function compressImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  let { width: w, height: h } = bmp
  if (w > MAX_PX) { h = Math.round((h * MAX_PX) / w); w = MAX_PX }
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const name = file.name.replace(/\.[^.]+$/, '.jpg')
  for (const q of [0.85, 0.65, 0.45]) {
    const blob = await toBlob(canvas, q)
    if (blob.size <= MAX_BYTES) return new File([blob], name, { type: 'image/jpeg' })
  }
  return new File([await toBlob(canvas, 0.45)], name, { type: 'image/jpeg' })
}

async function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.')
  if (!supabaseKey) throw new Error('Supabase publishable key is not configured.')
  const filePath = `gallery-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/gallery/${filePath}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', supabaseKey)
    xhr.setRequestHeader('Content-Type', 'image/jpeg')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.send(file)
  })

  onProgress(100)
  return supabase.storage.from('gallery').getPublicUrl(filePath).data.publicUrl
}

export default function CreateGalleryForm({
  onOptimisticAdd,
}: {
  onOptimisticAdd?: (photo: OptimisticPhoto) => void
}) {
  const [caption, setCaption]   = useState('')
  const [category, setCategory] = useState('')

  const [uploadedUrl, setUploadedUrl]         = useState('')
  const [pastedUrl, setPastedUrl]             = useState('')
  const [uploadProgress, setUploadProgress]   = useState<number | null>(null)
  const [uploadError, setUploadError]         = useState('')
  const [uploadInfo, setUploadInfo]           = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const effectiveUrl = uploadedUrl || pastedUrl

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(''); setUploadInfo(''); setUploadedUrl('')
    setUploadProgress(1)
    try {
      const origKb = Math.round(file.size / 1024)
      const compressed = await compressImage(file)
      const compKb = Math.round(compressed.size / 1024)
      setUploadProgress(5)
      const url = await uploadWithProgress(compressed, (pct) => setUploadProgress(5 + pct * 0.95))
      setUploadedUrl(url)
      setUploadInfo(origKb > compKb ? `Compressed ${origKb} KB → ${compKb} KB` : `${compKb} KB`)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(null)
    }
  }

  function clearUpload() {
    setUploadedUrl(''); setUploadInfo(''); setUploadError(''); setUploadProgress(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!effectiveUrl) return

    onOptimisticAdd?.({
      id: `opt-${Date.now()}`,
      url: effectiveUrl,
      caption: caption || null,
      category: category || null,
      isPublic: true,
      uploadedAt: new Date().toISOString(),
    })

    const fd = new FormData()
    fd.set('url', effectiveUrl)
    fd.set('caption', caption)
    fd.set('category', category)
    actionCreateGallery(fd).catch(console.error)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Image upload */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
          Photo <span className="text-secondary">*</span>
        </label>

        {uploadedUrl && (
          <div className="relative rounded-xl overflow-hidden border border-outline-variant dark:border-[#1e3461] aspect-video">
            <img src={uploadedUrl} alt="Preview" className="w-full h-full object-cover" />
            <button type="button" onClick={clearUpload}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
            </button>
          </div>
        )}

        {uploadProgress !== null && uploadProgress < 100 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant dark:text-blue-200/50">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 13 }}>progress_activity</span>
                Uploading…
              </span>
              <span className="font-semibold text-primary">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-container dark:bg-[#1a2d4f] overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {!uploadedUrl && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              disabled={uploadProgress !== null && uploadProgress < 100}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2 text-[12px] font-medium text-on-surface dark:text-blue-200 hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {uploadProgress !== null && uploadProgress < 100 ? 'hourglass_top' : 'upload'}
              </span>
              {uploadProgress !== null && uploadProgress < 100 ? 'Uploading…' : 'Upload photo'}
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 14 }}>link</span>
              <input
                type="url" placeholder="or paste image URL…"
                value={pastedUrl}
                onChange={(e) => setPastedUrl(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
              />
            </div>
          </div>
        )}

        {pastedUrl && !uploadedUrl && (
          <div className="relative rounded-xl overflow-hidden border border-outline-variant dark:border-[#1e3461] aspect-video">
            <img src={pastedUrl} alt="Preview" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button type="button" onClick={() => setPastedUrl('')}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
            </button>
          </div>
        )}

        {uploadError && (
          <p className="text-[11px] text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
            {uploadError}
          </p>
        )}
        {uploadInfo && !uploadError && (
          <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
            {uploadInfo}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Caption */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Caption</label>
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              placeholder="e.g. Annual general meeting"
              value={caption} onChange={(e) => setCaption(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
            />
          </div>
        </div>

        {/* Category — dropdown */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Category</label>
          <div className="relative rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
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

      {/* Info badge — always public */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <span className="material-symbols-outlined text-green-600 dark:text-green-400 flex-shrink-0" style={{ fontSize: 15 }}>public</span>
        <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
          Published to public gallery · Members will see this in their notifications
        </p>
      </div>

      <button
        type="submit"
        disabled={!effectiveUrl || (uploadProgress !== null && uploadProgress < 100)}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_photo_alternate</span>
        Add photo
      </button>
    </form>
  )
}
