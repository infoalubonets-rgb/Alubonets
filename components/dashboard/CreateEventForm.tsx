'use client'

import { useRef, useState, useEffect } from 'react'
import { actionCreateEvent, actionUpdateEvent } from '@/app/actions/domain'
import { createClient } from '@/utils/supabase/client'

type MemberOption = { id: string; fullName: string; email: string }

function toDateTimeLocal(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const MAX_PX   = 1024
const MAX_BYTES = 2 * 1024 * 1024
const DRAFT_KEY = 'alubonets-event-draft'

// ── image compression ────────────────────────────────────────────────────────

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

// ── XHR upload with real progress ───────────────────────────────────────────

async function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const filePath = `event-covers/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
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

// ── draft persistence ────────────────────────────────────────────────────────

type Draft = {
  title: string; startsAt: string; location: string
  description: string; uploadedUrl: string; isPublic: boolean
  sendEmail: boolean; emailAudience: 'ALL' | 'SELECTED'
}

function loadDraft(): Draft | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') } catch { return null }
}
function saveDraft(d: Draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
}

// ── component ────────────────────────────────────────────────────────────────

type OptimisticEvent = {
  id: string; title: string; description?: string | null
  location?: string | null; startsAt: string; imageUrl?: string | null; isPublic?: boolean
}

export default function CreateEventForm({
  onOptimisticAdd,
  onSuccess,
  members = [],
  initial,
}: {
  onOptimisticAdd?: (e: OptimisticEvent) => void
  onSuccess?: (e: OptimisticEvent) => void
  members?: MemberOption[]
  initial?: OptimisticEvent
}) {
  const isEditing = !!initial?.id
  const [title, setTitle]             = useState(initial?.title ?? '')
  const [startsAt, setStartsAt]       = useState(() => initial?.startsAt ? toDateTimeLocal(initial.startsAt) : '')
  const [location, setLocation]       = useState(initial?.location ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isPublic, setIsPublic]       = useState(initial?.isPublic !== false)
  const [sendEmail, setSendEmail]     = useState(true)
  const [emailAudience, setEmailAudience] = useState<'ALL' | 'SELECTED'>('ALL')
  const [selectedEmailMembers, setSelectedEmailMembers] = useState<Set<string>>(new Set())
  const [memberModalOpen, setMemberModalOpen] = useState(false)

  // upload track separately from paste URL; in edit mode seed with existing image
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [pastedUrl, setPastedUrl]     = useState(initial?.imageUrl ?? '')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadInfo, setUploadInfo]   = useState('')

  const [dateError, setDateError] = useState('')
  const [hasDraft, setHasDraft]   = useState(false)

  const fileRef      = useRef<HTMLInputElement>(null)
  const draftTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // effective image URL: uploaded takes precedence over pasted
  const effectiveUrl = uploadedUrl || pastedUrl

  // load draft on mount
  useEffect(() => {
    const d = loadDraft()
    if (d && (d.title || d.startsAt || d.uploadedUrl)) setHasDraft(true)
  }, [])

  function restoreDraft() {
    const d = loadDraft()
    if (!d) return
    setTitle(d.title)
    setStartsAt(d.startsAt)
    setLocation(d.location)
    setDescription(d.description)
    setUploadedUrl(d.uploadedUrl)
    setIsPublic(d.isPublic)
    if (d.sendEmail !== undefined) setSendEmail(d.sendEmail)
    if (d.emailAudience) setEmailAudience(d.emailAudience)
    setHasDraft(false)
  }

  function scheduleSave(patch?: Partial<Draft>) {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      saveDraft({
        title, startsAt, location, description,
        uploadedUrl, isPublic, sendEmail, emailAudience,
        ...patch,
      })
    }, 1200)
  }

  function toggleEmailMember(id: string) {
    setSelectedEmailMembers((prev) => {
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
    setUploadProgress(1) // show bar immediately — before compression
    try {
      const origKb = Math.round(file.size / 1024)
      const compressed = await compressImage(file)
      const compKb = Math.round(compressed.size / 1024)
      setUploadProgress(5) // compression done, upload starting
      const url = await uploadWithProgress(compressed, (pct) => setUploadProgress(5 + pct * 0.95))
      setUploadedUrl(url)
      setUploadInfo(origKb > compKb ? `Compressed ${origKb} KB → ${compKb} KB` : `${compKb} KB`)
      scheduleSave({ uploadedUrl: url })
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(null)
    }
  }

  function clearUpload() {
    setUploadedUrl('')
    setUploadInfo('')
    setUploadError('')
    setUploadProgress(null)
    if (fileRef.current) fileRef.current.value = ''
    scheduleSave({ uploadedUrl: '' })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title || !startsAt) return

    const fd = new FormData()
    fd.set('title', title)
    fd.set('startsAt', startsAt)
    fd.set('location', location)
    fd.set('description', description)
    fd.set('imageUrl', effectiveUrl)
    fd.set('isPublic', isPublic ? 'on' : 'off')

    if (isEditing) {
      // Edit mode — optimistic update and close
      onSuccess?.({
        id: initial!.id,
        title,
        description: description || null,
        location: location || null,
        startsAt: new Date(startsAt).toISOString(),
        imageUrl: effectiveUrl || null,
        isPublic,
      })
      actionUpdateEvent(initial!.id, fd).catch(console.error)
      return
    }

    // Create mode
    if (new Date(startsAt) < new Date()) {
      setDateError('Event date cannot be in the past')
      return
    }
    setDateError('')

    onOptimisticAdd?.({
      id: `opt-${Date.now()}`,
      title,
      description: description || null,
      location: location || null,
      startsAt,
      imageUrl: effectiveUrl || null,
      isPublic,
    })
    clearDraft()

    fd.set('sendEmail', sendEmail ? 'on' : 'off')
    fd.set('emailAudience', emailAudience)
    if (emailAudience === 'SELECTED') {
      selectedEmailMembers.forEach((id) => fd.append('emailMemberId', id))
    }
    actionCreateEvent(fd).catch(console.error)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Draft restore banner — create mode only */}
      {!isEditing && hasDraft && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 flex-shrink-0" style={{ fontSize: 17 }}>edit_note</span>
            <p className="text-[12px] text-amber-800 dark:text-amber-300 font-medium">You have an unsaved draft</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={restoreDraft}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline">
              Restore
            </button>
            <button type="button" onClick={() => { clearDraft(); setHasDraft(false) }}
              className="text-[11px] text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300">
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Title */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
            Title <span className="text-secondary">*</span>
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              name="title" required placeholder="e.g. Quarterly General Meeting"
              value={title} onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
            />
          </div>
        </div>

        {/* Date & time */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
            Date &amp; time <span className="text-secondary">*</span>
          </label>
          <div className={`flex items-center gap-2 rounded-xl border bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:ring-1 transition-all ${dateError ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400' : 'border-outline-variant dark:border-[#1e3461] focus-within:border-primary focus-within:ring-primary'}`}>
            <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 15 }}>schedule</span>
            <input
              name="startsAt" type="datetime-local" required
              value={startsAt} onChange={(e) => { setStartsAt(e.target.value); if (dateError) setDateError(''); scheduleSave({ startsAt: e.target.value }) }}
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50"
            />
          </div>
          {dateError && (
            <p className="text-[11px] text-red-500 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
              {dateError}
            </p>
          )}
        </div>

        {/* Location */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Location</label>
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 15 }}>location_on</span>
            <input
              name="location" placeholder="e.g. Community Hall"
              value={location} onChange={(e) => { setLocation(e.target.value); scheduleSave({ location: e.target.value }) }}
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Description</label>
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              name="description" placeholder="Short description"
              value={description} onChange={(e) => { setDescription(e.target.value); scheduleSave({ description: e.target.value }) }}
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
            />
          </div>
        </div>

        {/* Cover image */}
        <div className="sm:col-span-2 space-y-2">
          <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
            Cover image <span className="text-outline dark:text-blue-200/40 font-normal normal-case tracking-normal">(optional)</span>
          </label>

          {/* Preview (only shown when we have a URL from file upload) */}
          {uploadedUrl && (
            <div className="relative rounded-xl overflow-hidden border border-outline-variant dark:border-[#1e3461] h-32">
              <img src={uploadedUrl} alt="Cover preview" className="w-full h-full object-cover" />
              <button type="button" onClick={clearUpload}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors" aria-label="Remove image">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
              </button>
            </div>
          )}

          {/* Progress bar */}
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
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {uploadProgress === 100 && !uploadedUrl && (
            <div className="h-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
              <div className="h-full w-full rounded-full bg-primary" />
            </div>
          )}

          {/* Upload button row */}
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
                {uploadProgress !== null && uploadProgress < 100 ? 'Uploading…' : 'Upload image'}
              </button>

              {/* Paste external URL (e.g. Google Images) */}
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 14 }}>link</span>
                <input
                  type="url" placeholder="or paste an image URL…"
                  value={pastedUrl}
                  onChange={(e) => { setPastedUrl(e.target.value); scheduleSave({ uploadedUrl: e.target.value }) }}
                  className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
                />
              </div>
            </div>
          )}

          {/* Pasted URL preview */}
          {pastedUrl && !uploadedUrl && (
            <div className="relative rounded-xl overflow-hidden border border-outline-variant dark:border-[#1e3461] h-32">
              <img src={pastedUrl} alt="Cover preview" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <button type="button" onClick={() => setPastedUrl('')}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
              </button>
            </div>
          )}

          {uploadError && (
            <p className="text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1">
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
      </div>

      {/* Toggles */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button type="button" onClick={() => { setIsPublic((v) => !v); scheduleSave({ isPublic: !isPublic }) }}
          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${isPublic ? 'border-primary/40 bg-primary/5 dark:bg-primary/10' : 'border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36]'}`}>
          <div className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${isPublic ? 'bg-primary' : 'bg-outline/40 dark:bg-[#2a3f66]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-on-surface dark:text-blue-50 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{isPublic ? 'public' : 'lock'}</span>
              {isPublic ? 'Public event' : 'Members only'}
            </p>
            <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
              {isPublic ? 'On public site · notifies all members' : 'In-app only · not on public site'}
            </p>
          </div>
        </button>

        {!isEditing && (
          <button type="button" onClick={() => { setSendEmail((v) => !v); scheduleSave({ sendEmail: !sendEmail }) }}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${sendEmail ? 'border-blue-300/60 dark:border-blue-700/40 bg-blue-50/50 dark:bg-blue-950/20' : 'border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36]'}`}>
            <div className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${sendEmail ? 'bg-blue-500' : 'bg-outline/40 dark:bg-[#2a3f66]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sendEmail ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-on-surface dark:text-blue-50 flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
                Email members
              </p>
              <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                {sendEmail ? 'Send email notification to members' : 'No email will be sent'}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Email audience picker — shown when email is enabled (create mode only) */}
      {!isEditing && sendEmail && (
        <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Email recipients</p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="radio" checked={emailAudience === 'ALL'} onChange={() => { setEmailAudience('ALL'); scheduleSave({ emailAudience: 'ALL' }) }} />
              All members
            </label>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="radio" checked={emailAudience === 'SELECTED'} onChange={() => { setEmailAudience('SELECTED'); scheduleSave({ emailAudience: 'SELECTED' }) }} />
              Specific members
            </label>
          </div>

          {emailAudience === 'SELECTED' && (
            <div>
              {/* Selected member chips */}
              {selectedEmailMembers.size > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[...selectedEmailMembers].map((id) => {
                    const m = members.find((x) => x.id === id)
                    if (!m) return null
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full px-2.5 py-1 text-[11px] font-medium">
                        {m.fullName}
                        <button type="button" onClick={() => toggleEmailMember(id)} className="hover:text-blue-600 dark:hover:text-blue-100 leading-none">
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
                className="flex items-center gap-2 rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface dark:bg-[#0d1729] px-3 py-2 text-[12px] text-on-surface-variant hover:border-primary/40 hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>group</span>
                {selectedEmailMembers.size === 0 ? 'Choose members…' : `${selectedEmailMembers.size} selected — edit`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Member selection modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMemberModalOpen(false)}>
          <div className="w-full max-w-md bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant dark:border-[#1e3461]">
              <p className="text-[13px] font-bold text-on-surface dark:text-blue-50">Select members</p>
              <button type="button" onClick={() => setMemberModalOpen(false)} className="text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-80 divide-y divide-outline-variant/30 dark:divide-[#1e3461]/60">
              {members.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-on-surface-variant text-center">No active members.</p>
              ) : members.map((m) => {
                const checked = selectedEmailMembers.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleEmailMember(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${checked ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-surface-container dark:hover:bg-[#111f36]'}`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-blue-500 border-blue-500' : 'border-outline dark:border-[#2a3f66]'}`}>
                      {checked && <span className="material-symbols-outlined text-white" style={{ fontSize: 13 }}>check</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-on-surface dark:text-blue-50 truncate">{m.fullName || '—'}</p>
                      <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 truncate">{m.email}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="px-4 py-3 border-t border-outline-variant dark:border-[#1e3461] flex items-center justify-between">
              <p className="text-[12px] text-on-surface-variant">{selectedEmailMembers.size} selected</p>
              <button type="button" onClick={() => setMemberModalOpen(false)} className="bg-primary text-on-primary rounded-lg px-4 py-1.5 text-[12px] font-semibold hover:opacity-90 transition-opacity">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={uploadProgress !== null && uploadProgress < 100}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isEditing ? 'save' : 'add'}</span>
        {isEditing ? 'Save changes' : 'Save event'}
      </button>
    </form>
  )
}
