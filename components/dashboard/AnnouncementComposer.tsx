'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { actionSendAnnouncement } from '@/app/actions/domain'

type MemberOption = {
  id: string
  fullName: string
  email: string
}

export default function AnnouncementComposer({ members }: { members: MemberOption[] }) {
  const [audience, setAudience] = useState<'ALL' | 'SELECTED'>('ALL')
  const [sendEmail, setSendEmail] = useState(true)

  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const [expiresAt, setExpiresAt] = useState(defaultExpiry)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  function handleAction(formData: FormData) {
    startTransition(async () => {
      await actionSendAnnouncement(formData)
      window.dispatchEvent(new Event('new-announcement'))
      formRef.current?.reset()
      setAudience('ALL')
      setSendEmail(true)
      setExpiresAt(defaultExpiry)
      setSelected(new Set())
    })
  }

  useEffect(() => {
    if (!pickerOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [pickerOpen])

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectedLabel =
    selected.size === 0
      ? 'Select members…'
      : selected.size === 1
        ? members.find((m) => selected.has(m.id))?.fullName || '1 member'
        : `${selected.size} members selected`

  return (
    <form ref={formRef} action={handleAction} className="grid gap-3">
      <input name="title" placeholder="Title" required className="border rounded-lg px-3 py-2" />
      <textarea
        name="content"
        placeholder="Write your announcement…"
        required
        rows={3}
        className="border rounded-lg px-3 py-2"
      />

      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="sendEmail" value={sendEmail ? 'on' : 'off'} />
      <input type="hidden" name="expiresAt" value={expiresAt} />
      {audience === 'SELECTED' &&
        [...selected].map((id) => <input key={id} type="hidden" name="memberIds" value={id} />)}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="audienceChoice"
            checked={audience === 'ALL'}
            onChange={() => setAudience('ALL')}
          />
          Broadcast to all members
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="audienceChoice"
            checked={audience === 'SELECTED'}
            onChange={() => setAudience('SELECTED')}
          />
          Specific members
        </label>
      </div>

      {/* Email toggle — only shown for broadcast */}
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
          <div className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${sendEmail ? 'bg-primary' : 'bg-outline/40'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${sendEmail ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
          {sendEmail ? 'Also sending to all member emails' : 'Send by email too'}
        </button>
      )}

      {audience === 'SELECTED' && (
        <div className="space-y-2" ref={pickerRef}>
          {/* Selected member chips */}
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...selected].map((id) => {
                const m = members.find((x) => x.id === id)
                if (!m) return null
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary dark:text-blue-300 rounded-full px-2.5 py-1 text-[12px] font-medium">
                    {m.fullName}
                    <button type="button" onClick={() => toggleMember(id)} className="hover:text-primary/60 leading-none">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="w-full md:w-80 flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left bg-surface hover:bg-surface-container transition-colors"
            >
              <span className="text-on-surface-variant">
                {selected.size === 0 ? 'Select members…' : 'Add more members…'}
              </span>
              <span className="material-symbols-outlined text-[18px]">
                {pickerOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {pickerOpen && (
              <div className="absolute z-30 mt-1 w-full md:w-80 max-h-64 overflow-y-auto rounded-lg border border-outline-variant bg-surface shadow-lg">
                {members.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-on-surface-variant">No active members.</p>
                ) : (
                  members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-surface-container border-b border-outline-variant/40 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{m.fullName}</span>
                        <span className="block text-[12px] text-on-surface-variant truncate">
                          {m.email}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete reminder date */}
      <div className="flex items-center gap-3 text-[12px] text-on-surface-variant">
        <span className="material-symbols-outlined text-[15px] text-outline">alarm</span>
        <label className="flex items-center gap-2">
          Remind me to remove this after:
          <input
            type="date"
            value={expiresAt}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="border border-outline-variant rounded-lg px-2 py-1 text-[12px] bg-surface text-on-surface"
          />
        </label>
      </div>

      <button
        disabled={isPending}
        className="bg-primary text-on-primary rounded-lg px-4 py-2 justify-self-start disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending…' : 'Send announcement'}
      </button>
    </form>
  )
}
