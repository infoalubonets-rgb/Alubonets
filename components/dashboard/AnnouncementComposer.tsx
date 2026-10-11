'use client'

import { useRef, useState, useTransition } from 'react'
import { actionSendAnnouncement, actionUploadAnnouncementImage } from '@/app/actions/domain'

type MemberOption = { id: string; fullName: string; email: string; phone?: string | null }

function MemberSearchModal({
  members,
  selected,
  onToggle,
  onClose,
}: {
  members: MemberOption[]
  selected: Set<string>
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant dark:border-[#1a2d4f]">
          <h3 className="font-bold text-[14px] text-on-surface dark:text-blue-50">
            Select members
          </h3>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <span className="text-[12px] font-semibold text-[#fe8015]">
                {selected.size} selected
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-outline-variant/40 dark:border-[#1a2d4f]">
          <div className="relative">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              style={{ fontSize: 16 }}
            >
              search
            </span>
            <input
              autoFocus
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] text-[13px] text-on-surface dark:text-blue-50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-on-surface-variant text-center">
              No members found.
            </p>
          ) : (
            filtered.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-surface-container/60 dark:hover:bg-[#111f36] border-b border-outline-variant/30 dark:border-[#1a2d4f] last:border-b-0 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => onToggle(m.id)}
                  className="h-4 w-4 rounded border-outline-variant accent-primary cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 truncate">
                    {m.fullName}
                  </p>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 truncate">
                    {[m.email, m.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {selected.has(m.id) && (
                  <span
                    className="material-symbols-outlined icon-fill text-primary flex-shrink-0"
                    style={{ fontSize: 16 }}
                  >
                    check_circle
                  </span>
                )}
              </label>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-outline-variant dark:border-[#1a2d4f] flex items-center justify-between">
          <p className="text-[12px] text-on-surface-variant">
            {selected.size === 0
              ? 'No members selected'
              : `${selected.size} member${selected.size !== 1 ? 's' : ''} selected`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#fe8015] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementComposer({
  members,
  onSuccess,
}: {
  members: MemberOption[]
  onSuccess?: () => void
}) {
  const [audience, setAudience] = useState<'ALL' | 'SELECTED'>('ALL')
  const [sendEmail, setSendEmail] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [memberModalOpen, setMemberModalOpen] = useState(false)

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null) // local blob URL
  const [imageUrl, setImageUrl] = useState<string>('') // confirmed uploaded URL
  const [urlInput, setUrlInput] = useState<string>('') // manual URL fallback
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImagePreview(URL.createObjectURL(file))
    setImageUrl('')
    setUrlInput('')
    setShowUrlInput(false)
    setUploading(true)
    setUploadError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await actionUploadAnnouncementImage(fd)
      setImageUrl(result.url)
    } catch {
      setUploadError('Upload failed. Try pasting a URL instead.')
      setImagePreview(null)
    } finally {
      setUploading(false)
    }
  }

  function clearImage() {
    setImagePreview(null)
    setImageUrl('')
    setUrlInput('')
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleAction(formData: FormData) {
    const finalImageUrl = imageUrl || urlInput.trim()
    if (finalImageUrl) formData.set('imageUrl', finalImageUrl)

    startTransition(async () => {
      if (formData.get('sendEmail') === 'on') window.dispatchEvent(new Event('email-send-started'))
      await actionSendAnnouncement(formData)
      window.dispatchEvent(new Event('new-announcement'))
      formRef.current?.reset()
      setAudience('ALL')
      setSendEmail(true)
      setSelected(new Set())
      clearImage()
      setShowUrlInput(false)
      onSuccess?.()
    })
  }

  const effectiveImageUrl = imageUrl || urlInput.trim()

  return (
    <>
      <form ref={formRef} action={handleAction} className="grid gap-3">
        <input
          name="title"
          placeholder="Title"
          required
          className="border border-outline-variant dark:border-[#1e3461] rounded-xl px-3 py-2 text-[13px] bg-surface dark:bg-[#111f36] text-on-surface dark:text-blue-50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          name="content"
          placeholder="Write your announcement…"
          required
          rows={4}
          className="border border-outline-variant dark:border-[#1e3461] rounded-xl px-3 py-2 text-[13px] bg-surface dark:bg-[#111f36] text-on-surface dark:text-blue-50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />

        {/* Image section */}
        <div className="space-y-2">
          {/* Preview / upload zone */}
          {effectiveImageUrl || imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-outline-variant/40 dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36]">
              <img
                src={imagePreview ?? effectiveImageUrl}
                alt=""
                className={`w-full max-h-48 object-cover transition-opacity ${uploading ? 'opacity-40' : 'opacity-100'}`}
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-black/60 rounded-xl px-3 py-2">
                    <span className="material-symbols-outlined text-white animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                    <span className="text-white text-[12px] font-semibold">Uploading…</span>
                  </div>
                </div>
              )}
              {!uploading && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                  title="Remove image"
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>close</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-outline-variant/60 dark:border-[#1e3461] hover:border-[#fe8015]/50 hover:bg-[#fe8015]/4 transition-colors text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[28px] text-outline/60">add_photo_alternate</span>
              <span className="text-[12px] font-medium">Add image (optional)</span>
            </button>
          )}

          {/* Error */}
          {uploadError && (
            <p className="text-[12px] text-red-500 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
              {uploadError}
            </p>
          )}

          {/* Secondary: paste URL */}
          {!effectiveImageUrl && !imagePreview && (
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className="text-[11px] text-on-surface-variant hover:text-[#fe8015] flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>link</span>
              {showUrlInput ? 'Hide URL input' : 'Or paste an image URL'}
            </button>
          )}
          {showUrlInput && !effectiveImageUrl && !imagePreview && (
            <input
              type="url"
              placeholder="https://…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant dark:border-[#1e3461] rounded-xl text-[13px] bg-surface dark:bg-[#111f36] text-on-surface dark:text-blue-50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Hidden fields */}
        <input type="hidden" name="audience" value={audience} />
        <input type="hidden" name="sendEmail" value={sendEmail ? 'on' : 'off'} />
        {audience === 'SELECTED' &&
          [...selected].map((id) => (
            <input key={id} type="hidden" name="memberIds" value={id} />
          ))}

        {/* Audience toggle */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="radio"
              name="audienceChoice"
              checked={audience === 'ALL'}
              onChange={() => setAudience('ALL')}
              className="accent-primary"
            />
            Broadcast to all members
          </label>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="radio"
              name="audienceChoice"
              checked={audience === 'SELECTED'}
              onChange={() => setAudience('SELECTED')}
              className="accent-primary"
            />
            Specific members
          </label>
        </div>

        {/* Email toggle — broadcast only */}
        {audience === 'ALL' && (
          <button
            type="button"
            onClick={() => setSendEmail((v) => !v)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors text-[12px] ${
              sendEmail
                ? 'border-primary/40 bg-primary/5 text-primary dark:text-blue-300'
                : 'border-outline-variant bg-surface-container text-on-surface-variant'
            }`}
          >
            <div
              className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${sendEmail ? 'bg-primary' : 'bg-outline/40'}`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${sendEmail ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
              />
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
            {sendEmail ? 'Also sending to all member emails' : 'Send by email too'}
          </button>
        )}

        {/* Specific member selection */}
        {audience === 'SELECTED' && (
          <div className="space-y-2">
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...selected].map((id) => {
                  const m = members.find((x) => x.id === id)
                  if (!m) return null
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 bg-primary/10 text-primary dark:text-blue-300 rounded-full px-2.5 py-1 text-[12px] font-medium"
                    >
                      {m.fullName}
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="hover:text-primary/60 leading-none"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMemberModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant dark:border-[#1e3461] text-[13px] text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group_add</span>
              {selected.size === 0 ? 'Choose members…' : `${selected.size} selected — edit`}
            </button>
          </div>
        )}

        <button
          disabled={isPending || uploading}
          className="inline-flex items-center justify-center gap-1.5 bg-[#fe8015] text-white rounded-xl px-4 py-2.5 text-[13px] font-semibold justify-self-start hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span>
          {isPending ? 'Sending…' : uploading ? 'Uploading image…' : 'Send notification'}
        </button>
      </form>

      {memberModalOpen && (
        <MemberSearchModal
          members={members}
          selected={selected}
          onToggle={toggleMember}
          onClose={() => setMemberModalOpen(false)}
        />
      )}
    </>
  )
}
