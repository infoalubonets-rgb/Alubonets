'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const MAX_PX = 1024
const MAX_BYTES = 2 * 1024 * 1024

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
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const name = file.name.replace(/\.[^.]+$/, '.jpg')
  for (const q of [0.82, 0.6, 0.38]) {
    const blob = await toBlob(canvas, q)
    if (blob.size <= MAX_BYTES) return new File([blob], name, { type: 'image/jpeg' })
  }
  return new File([await toBlob(canvas, 0.38)], name, { type: 'image/jpeg' })
}

async function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.')
  if (!supabaseKey) throw new Error('Supabase publishable key is not configured.')
  const filePath = `event-covers/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
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

type Props = {
  initialUrl?: string | null
  name?: string
  value?: string
  onChange?: (url: string) => void
  uploadingChange?: (busy: boolean) => void
}

export default function EventCoverUpload({
  initialUrl = '',
  name,
  value,
  onChange,
  uploadingChange,
}: Props) {
  const [internalUrl, setInternalUrl] = useState(initialUrl ?? '')
  const [pastedUrl, setPastedUrl] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadInfo, setUploadInfo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadedUrl = value !== undefined ? value : internalUrl
  const previewUrl = uploadedUrl || pastedUrl
  const uploading = uploadProgress !== null && uploadProgress < 100

  function setUrl(url: string) {
    if (value === undefined) setInternalUrl(url)
    onChange?.(url)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadInfo('')
    setUploadProgress(1)
    uploadingChange?.(true)
    try {
      const origKb = Math.round(file.size / 1024)
      const compressed = await compressImage(file)
      const compKb = Math.round(compressed.size / 1024)
      setUploadProgress(5)
      const url = await uploadWithProgress(compressed, (pct) => setUploadProgress(5 + pct * 0.95))
      setPastedUrl('')
      setUrl(url)
      setUploadInfo(origKb > compKb ? `Compressed ${origKb} KB → ${compKb} KB` : `${compKb} KB`)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(null)
    } finally {
      uploadingChange?.(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function clearPhoto() {
    setUrl('')
    setPastedUrl('')
    setUploadInfo('')
    setUploadError('')
    setUploadProgress(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant dark:text-blue-200/60">
        Cover photo <span className="font-normal normal-case tracking-normal text-outline dark:text-blue-200/40">(optional)</span>
      </label>
      {name && <input type="hidden" name={name} value={previewUrl} />}

      {previewUrl && (
        <div className="relative h-36 overflow-hidden rounded-xl border border-outline-variant dark:border-[#1e3461]">
          <img src={previewUrl} alt="Cover preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <button
            type="button"
            onClick={clearPhoto}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
            aria-label="Remove photo"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
          </button>
        </div>
      )}

      {uploading && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-on-surface-variant dark:text-blue-200/50">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 13 }}>progress_activity</span>
              Uploading…
            </span>
            <span className="font-semibold text-primary">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container dark:bg-[#1a2d4f]">
            <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-outline-variant bg-surface-container px-4 py-2.5 text-[12px] font-medium text-on-surface transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:opacity-50 dark:border-[#1e3461] dark:bg-[#111f36] dark:text-blue-200"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {uploading ? 'hourglass_top' : 'add_photo_alternate'}
          </span>
          {uploading ? 'Uploading…' : previewUrl ? 'Change photo' : 'Upload photo'}
        </button>
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary dark:border-[#1e3461] dark:bg-[#111f36]">
          <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 14 }}>link</span>
          <input
            type="url"
            placeholder="or paste an image URL…"
            value={pastedUrl}
            onChange={(e) => {
              const next = e.target.value
              setPastedUrl(next)
              setUrl(next)
            }}
            className="flex-1 bg-transparent text-[13px] text-on-surface outline-none placeholder:text-outline dark:text-blue-50 dark:placeholder:text-blue-200/30"
          />
        </div>
      </div>

      {uploadError && (
        <p className="flex items-center gap-1 text-[11px] text-red-500 dark:text-red-400">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
          {uploadError}
        </p>
      )}
      {uploadInfo && !uploadError && (
        <p className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
          {uploadInfo}
        </p>
      )}
    </div>
  )
}
