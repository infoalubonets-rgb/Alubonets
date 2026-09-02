'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import {
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_ATTACHMENT_BYTES,
  MAX_ANNOUNCEMENT_ATTACHMENTS_TOTAL_BYTES,
  formatMb,
} from '@/lib/announcement-attachments'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

type AnnouncementRow = {
  id: string
  title: string
  status: string
  author: string
  createdAt: string
  sent: number
  failed: number
}

type TemplateRow = { id: string; key: string; name: string }
type MemberOption = { id: string; fullName: string }

type Props = {
  createAction: (formData: FormData) => Promise<void>
  retryAction: (formData: FormData) => Promise<unknown>
  templateAction: (formData: FormData) => Promise<void>
  announcements: AnnouncementRow[]
  templates: TemplateRow[]
  members: MemberOption[]
  branches: string[]
  nowInputValue: string
}

export default function AnnouncementsAdminClient({
  createAction,
  retryAction,
  templateAction,
  announcements,
  templates,
  members,
  branches,
  nowInputValue,
}: Props) {
  const [modal, setModal] = useState<null | 'send' | 'history'>(null)
  const [attachmentError, setAttachmentError] = useState('')
  const totalSent = announcements.reduce((sum, a) => sum + a.sent, 0)
  const totalFailed = announcements.reduce((sum, a) => sum + a.failed, 0)

  function handleComposeSubmit(event: FormEvent<HTMLFormElement>) {
    const files = new FormData(event.currentTarget).getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length > MAX_ANNOUNCEMENT_ATTACHMENTS) {
      event.preventDefault()
      setAttachmentError(`Attach at most ${MAX_ANNOUNCEMENT_ATTACHMENTS} files.`)
      return
    }
    const tooBig = files.find((f) => f.size > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES)
    if (tooBig) {
      event.preventDefault()
      setAttachmentError(`"${tooBig.name}" is larger than ${formatMb(MAX_ANNOUNCEMENT_ATTACHMENT_BYTES)}MB.`)
      return
    }
    const total = files.reduce((sum, f) => sum + f.size, 0)
    if (total > MAX_ANNOUNCEMENT_ATTACHMENTS_TOTAL_BYTES) {
      event.preventDefault()
      setAttachmentError(`Attachments total ${formatMb(total)}MB — keep the combined size under ${formatMb(MAX_ANNOUNCEMENT_ATTACHMENTS_TOTAL_BYTES)}MB.`)
      return
    }
    setAttachmentError('')
    setModal(null)
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setModal('send')}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary-container px-4 py-2.5 text-sm font-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.25)] transition hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          Send notification
        </button>
        <button
          onClick={() => setModal('history')}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-secondary-container/40 bg-secondary-container/10 px-4 py-2.5 text-sm font-bold text-secondary transition hover:bg-secondary-container/20"
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          Notification history
          <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-primary">{announcements.length}</span>
        </button>
      </div>

      {modal === 'send' && (
        <Modal title="Send notification" icon="send" onClose={() => setModal(null)}>
          <form action={createAction} onSubmit={handleComposeSubmit} className="grid gap-3 md:grid-cols-2">
            <input name="title" required placeholder="Title" className="rounded-lg border px-3 py-2 md:col-span-2" />
            <textarea name="content" required placeholder="Content" className="rounded-lg border px-3 py-2 md:col-span-2" rows={4} />
            <label className="text-xs font-bold text-on-surface-variant md:col-span-2">
              Attachments <span className="font-normal text-on-surface-variant">(optional)</span>
              <input
                name="attachments"
                type="file"
                multiple
                onChange={() => setAttachmentError('')}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
                Up to {MAX_ANNOUNCEMENT_ATTACHMENTS} files, {formatMb(MAX_ANNOUNCEMENT_ATTACHMENT_BYTES)}MB each, {formatMb(MAX_ANNOUNCEMENT_ATTACHMENTS_TOTAL_BYTES)}MB combined.
              </span>
              {attachmentError && <span className="mt-1 block text-[11px] font-semibold text-error">{attachmentError}</span>}
            </label>
            <select name="templateKey" className="rounded-lg border px-3 py-2">
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.key}>{t.name}</option>
              ))}
            </select>
            <input
              name="scheduledFor"
              type="datetime-local"
              min={nowInputValue}
              title="An announcement can only be scheduled for a future date and time."
              className="rounded-lg border px-3 py-2"
            />
            <select name="familyBranch" className="rounded-lg border px-3 py-2 md:col-span-2">
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <fieldset className="flex flex-wrap gap-2 text-xs md:col-span-2">
              <legend className="mb-1 w-full text-xs font-bold text-on-surface-variant">Audience — leave blank to notify everyone</legend>
              {ROLES.map((role) => (
                <label key={role} className="rounded-full border px-2.5 py-1">
                  <input type="checkbox" name="audienceRoles" value={role} className="mr-1" /> {role}
                </label>
              ))}
            </fieldset>
            <label className="text-xs font-bold text-on-surface-variant md:col-span-2">
              Or pick specific members
              <select name="memberIds" multiple className="mt-1 h-28 w-full rounded-lg border px-2 text-sm font-normal">
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="sendEmail" defaultChecked /> Also email recipients
              <span className="text-xs text-on-surface-variant">(the in-app notification is always sent)</span>
            </label>

            <details className="rounded-lg border p-3 text-xs md:col-span-2">
              <summary className="cursor-pointer font-bold text-on-surface-variant">Manage templates</summary>
              <TemplateManager templateAction={templateAction} templates={templates} />
            </details>

            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary md:col-span-2">Publish / schedule</button>
          </form>
        </Modal>
      )}

      {modal === 'history' && (
        <Modal title="Notification history" icon="history" onClose={() => setModal(null)}>
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 40 }}>inbox</span>
              <p className="text-sm text-on-surface-variant">No notifications sent yet.</p>
              <p className="text-xs text-on-surface-variant">Emails sent: 0 · Failed: 0</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant">Emails sent: {totalSent} · Failed: {totalFailed}</p>
              {announcements.map((a) => (
                <article key={a.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <b>{a.title}</b> · {a.status}
                      <p className="text-xs text-on-surface-variant">
                        {a.author} · {new Date(a.createdAt).toLocaleString()} · email sent {a.sent} · failed {a.failed}
                      </p>
                    </div>
                    {a.failed > 0 && (
                      <form action={async (formData) => { await retryAction(formData) }}>
                        <input type="hidden" name="announcementId" value={a.id} />
                        <button className="text-primary underline">Retry failed emails</button>
                      </form>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

function TemplateManager({
  templateAction,
  templates,
}: {
  templateAction: (formData: FormData) => Promise<void>
  templates: TemplateRow[]
}) {
  return (
    <div className="mt-3 space-y-3">
      <form action={templateAction} className="grid gap-2 md:grid-cols-2">
        <input name="key" required placeholder="key e.g. welcome" className="rounded-lg border px-3 py-2" />
        <input name="name" required placeholder="Display name" className="rounded-lg border px-3 py-2" />
        <input name="subject" required placeholder="Email subject" className="rounded-lg border px-3 py-2 md:col-span-2" />
        <textarea name="bodyHtml" required placeholder="HTML body ({{title}}, {{content}})" className="rounded-lg border px-3 py-2 md:col-span-2" rows={3} />
        <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary md:col-span-2">Save template</button>
      </form>
      <ul className="space-y-1">
        {templates.length === 0 && <li className="text-on-surface-variant">No templates yet.</li>}
        {templates.map((t) => (
          <li key={t.id}><b>{t.key}</b> — {t.name}</li>
        ))}
      </ul>
    </div>
  )
}

function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,31,80,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-2xl dark:border-[#1a2d4f] dark:bg-[#0d1729]">
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-5 py-4 dark:border-[#1a2d4f]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-container/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>{icon}</span>
            </div>
            <h2 className="text-[15px] font-semibold text-on-surface dark:text-blue-50">{title}</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container dark:hover:bg-[#111f36]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
