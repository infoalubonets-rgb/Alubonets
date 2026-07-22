'use client'

import { useRef, useState } from 'react'
import { actionUpsertProject } from '@/app/actions/domain'
import { createClient } from '@/utils/supabase/client'

type MemberOption = { id: string; fullName: string; email: string }

type ProjectRow = {
  id: string
  title: string
  description: string
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED'
  imageUrl?: string | null
  progress: number
  updatedAt: string
}

type Props = {
  members?: MemberOption[]
  initial?: ProjectRow
  onSuccess?: (p: ProjectRow) => void
}

// ── image compression ─────────────────────────────────────────────────────────

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
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const name = file.name.replace(/\.[^.]+$/, '.jpg')
  for (const q of [0.82, 0.6, 0.38]) {
    const blob = await toBlob(canvas, q)
    if (blob.size <= MAX_BYTES) return new File([blob], name, { type: 'image/jpeg' })
  }
  return new File([await toBlob(canvas, 0.38)], name, { type: 'image/jpeg' })
}

async function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const filePath = `project-covers/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/gallery/${filePath}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
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

// ── component ─────────────────────────────────────────────────────────────────

export default function UpsertProjectForm({ members = [], initial, onSuccess }: Props) {
  const existingId = initial?.id

  const [title, setTitle]       = useState(initial?.title ?? '')
  const [description, setDesc]  = useState(initial?.description ?? '')
  const [status, setStatus]     = useState<'UPCOMING' | 'ONGOING' | 'COMPLETED'>(initial?.status ?? 'UPCOMING')
  const [progress, setProgress] = useState(initial?.progress ?? 0)

  // image upload state
  const [uploadedUrl, setUploadedUrl]       = useState(initial?.imageUrl ?? '')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError]       = useState('')
  const [uploadInfo, setUploadInfo]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // email / member selection
  const [sendEmail, setSendEmail]           = useState(true)
  const [emailAudience, setEmailAudience]   = useState<'ALL' | 'SELECTED'>('ALL')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [memberModalOpen, setMemberModalOpen] = useState(false)

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadInfo('')
    setUploadedUrl('')
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
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // auto-set progress to 100 when status is COMPLETED
  function handleStatusChange(s: 'UPCOMING' | 'ONGOING' | 'COMPLETED') {
    setStatus(s)
    if (s === 'COMPLETED') setProgress(100)
    if (s === 'UPCOMING') setProgress(0)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title || !description) return

    onSuccess?.({
      id: existingId ?? `opt-${Date.now()}`,
      title,
      description,
      status,
      imageUrl: uploadedUrl || null,
      progress,
      updatedAt: new Date().toISOString(),
    })

    const fd = new FormData()
    if (existingId) fd.set('id', existingId)
    fd.set('title', title)
    fd.set('description', description)
    fd.set('status', status)
    fd.set('progress', String(progress))
    if (uploadedUrl) fd.set('imageUrl', uploadedUrl)
    fd.set('sendEmail', sendEmail && !existingId ? 'on' : 'off')
    fd.set('emailAudience', emailAudience)
    if (emailAudience === 'SELECTED') {
      selectedMembers.forEach((id) => fd.append('emailMemberId', id))
    }
    actionUpsertProject(fd).catch(console.error)
  }

  const uploading = uploadProgress !== null && uploadProgress < 100

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">

      {/* Title + Status */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Title <span className="text-secondary">*</span>
          </label>
          <input
            name="title" required placeholder="Project title"
            value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Status</label>
          <select
            name="status" value={status}
            onChange={(e) => handleStatusChange(e.target.value as typeof status)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] bg-surface text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="UPCOMING">Upcoming</option>
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
          Description <span className="text-secondary">*</span>
        </label>
        <textarea
          name="description" required placeholder="Project description" rows={3}
          value={description} onChange={(e) => setDesc(e.target.value)}
          className="w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Progress</label>
          <span className="text-[13px] font-bold text-primary">{progress}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Cover image upload */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
          Cover image <span className="normal-case font-normal text-on-surface-variant/60">(optional)</span>
        </label>

        {uploadedUrl && (
          <div className="relative rounded-xl overflow-hidden aspect-video bg-surface-container">
            <img src={uploadedUrl} alt="Project cover" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setUploadedUrl(''); setUploadInfo('') }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
            </button>
          </div>
        )}

        {/* Progress bar */}
        {uploadProgress !== null && uploadProgress < 100 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span>Uploading…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-outline-variant/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
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

        {!uploadedUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-dashed border-outline-variant hover:border-primary/60 bg-surface-container hover:bg-primary/5 px-4 py-3 text-[12px] text-on-surface-variant hover:text-primary transition-all w-full justify-center disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_photo_alternate</span>
            {uploading ? 'Uploading…' : 'Upload cover image'}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Email toggle — only for new projects */}
      {!existingId && (
        <div className="space-y-2 rounded-xl border border-outline-variant p-3">
          <button
            type="button"
            onClick={() => setSendEmail((v) => !v)}
            className="flex items-center gap-3 w-full text-left"
          >
            <div className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${sendEmail ? 'bg-blue-500' : 'bg-outline/40'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sendEmail ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
                Email members about this project
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {sendEmail ? 'Will send email when project is saved' : 'No email will be sent'}
              </p>
            </div>
          </button>

          {sendEmail && (
            <div className="space-y-2 pt-2 border-t border-outline-variant/40">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                  <input type="radio" checked={emailAudience === 'ALL'} onChange={() => setEmailAudience('ALL')} />
                  All members
                </label>
                <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                  <input type="radio" checked={emailAudience === 'SELECTED'} onChange={() => setEmailAudience('SELECTED')} />
                  Specific members
                </label>
              </div>

              {emailAudience === 'SELECTED' && (
                <div>
                  {selectedMembers.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[...selectedMembers].map((id) => {
                        const m = members.find((x) => x.id === id)
                        if (!m) return null
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[11px] font-medium">
                            {m.fullName}
                            <button type="button" onClick={() => toggleMember(id)} className="hover:text-primary/60 leading-none">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMemberModalOpen(true)}
                    className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-[12px] text-on-surface-variant hover:border-primary/40 hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>group</span>
                    {selectedMembers.size === 0 ? 'Choose members…' : `${selectedMembers.size} selected — edit`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={uploading}
        className="bg-primary text-on-primary rounded-lg px-4 py-2.5 text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {existingId ? 'Save changes' : 'Save project'}
      </button>

      {/* Member selection modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMemberModalOpen(false)}>
          <div className="w-full max-w-lg bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant dark:border-[#1e3461]">
              <div>
                <p className="text-[14px] font-bold text-on-surface dark:text-blue-50">Select members</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{members.length} active members</p>
              </div>
              <button type="button" onClick={() => setMemberModalOpen(false)} className="text-outline hover:text-on-surface transition-colors p-1">
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[420px] divide-y divide-outline-variant/30 dark:divide-[#1e3461]/60">
              {members.length === 0 ? (
                <p className="px-5 py-8 text-[13px] text-on-surface-variant text-center">No active members.</p>
              ) : members.map((m) => {
                const checked = selectedMembers.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${checked ? 'bg-primary/5 dark:bg-blue-950/30' : 'hover:bg-surface-container dark:hover:bg-[#111f36]'}`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary' : 'border-outline dark:border-[#2a3f66]'}`}>
                      {checked && <span className="material-symbols-outlined text-white" style={{ fontSize: 15 }}>check</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">{m.fullName || '—'}</p>
                      <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">{m.email}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="px-5 py-4 border-t border-outline-variant dark:border-[#1e3461] flex items-center justify-between">
              <p className="text-[13px] text-on-surface-variant">{selectedMembers.size} of {members.length} selected</p>
              <button type="button" onClick={() => setMemberModalOpen(false)} className="bg-primary text-on-primary rounded-lg px-5 py-2 text-[13px] font-semibold hover:opacity-90 transition-opacity">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
