'use client'

import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ContactDestinationSettingsButton from '@/components/admin/ContactDestinationSettingsButton'
import StatCard from '@/components/dashboard/StatCard'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/lib/auth/types'
import { ANNOUNCEMENT_ATTACHMENT_ACCEPT, validateAnnouncementAttachmentFiles } from '@/lib/announcement-attachments'
import { actionMarkAnnouncementsRead } from '@/app/actions/domain'

type AnnouncementRow = {
  id: string
  title: string
  status: string
  author: string
  createdAt: string
  sent: number
  failed: number
}

type MemberOption = { id: string; fullName: string; role: Role }

type Props = {
  isSuperAdmin: boolean
  contactDestinationEmail: string
  updateContactDestination: (formData: FormData) => Promise<void>
  createAction: (formData: FormData) => Promise<void>
  retryAction: (formData: FormData) => Promise<unknown>
  announcements: AnnouncementRow[]
  members: MemberOption[]
  totalSent: number
  totalFailed: number
  contactInbox?: ReactNode
  /** Set while email is in test mode: every email goes only to this address. */
  emailTestRecipient?: string | null
}

export default function CommunicationsAdminRoot({
  isSuperAdmin,
  contactDestinationEmail,
  updateContactDestination,
  createAction,
  retryAction,
  announcements,
  members,
  totalSent,
  totalFailed,
  contactInbox,
  emailTestRecipient = null,
}: Props) {
  const [modal, setModal] = useState<null | 'send' | 'history'>(null)
  const [historyBadge, setHistoryBadge] = useState(announcements.length)
  const [attachmentError, setAttachmentError] = useState('')
  const [audienceCategory, setAudienceCategory] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [selectAllMembers, setSelectAllMembers] = useState(false)
  const [externalEmails, setExternalEmails] = useState([''])

  const filteredMembers = useMemo(
    () => (audienceCategory ? members.filter((member) => member.role === audienceCategory) : members),
    [audienceCategory, members],
  )

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 3)
    const error = validateAnnouncementAttachmentFiles(files)
    setAttachmentError(error || '')
    if (error) event.target.value = ''
  }

  function toggleMember(id: string) {
    setSelectAllMembers(false)
    setSelectedMemberIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectAllMembers) {
      setSelectAllMembers(false)
      setSelectedMemberIds(new Set())
      return
    }
    setSelectAllMembers(true)
    setSelectedMemberIds(new Set(filteredMembers.map((member) => member.id)))
  }

  function handleCategoryChange(value: string) {
    setAudienceCategory(value)
    setSelectAllMembers(false)
    setSelectedMemberIds(new Set())
  }

  function addExternalEmailField() {
    setExternalEmails((current) => [...current, ''])
  }

  function updateExternalEmail(index: number, value: string) {
    setExternalEmails((current) => current.map((email, i) => (i === index ? value : email)))
  }

  function removeExternalEmail(index: number) {
    setExternalEmails((current) => (current.length <= 1 ? [''] : current.filter((_, i) => i !== index)))
  }

  function handleComposeSubmit(event: FormEvent<HTMLFormElement>) {
    const files = new FormData(event.currentTarget).getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
    const error = validateAnnouncementAttachmentFiles(files)
    if (error) {
      event.preventDefault()
      setAttachmentError(error)
      return
    }
    const hasMembers = selectAllMembers || selectedMemberIds.size > 0
    const hasExternal = externalEmails.some((email) => email.trim())
    if (!hasMembers && !hasExternal) {
      event.preventDefault()
      setAttachmentError('Select at least one member or add an external email.')
      return
    }
    setAttachmentError('')
    setModal(null)
    // Show the sending progress banner straight away.
    window.dispatchEvent(new Event('email-send-started'))
  }

  function resetSendForm() {
    setAttachmentError('')
    setAudienceCategory('')
    setSelectedMemberIds(new Set())
    setSelectAllMembers(false)
    setExternalEmails([''])
  }

  function openNotificationHistory() {
    setModal('history')
    setHistoryBadge(0)
    window.dispatchEvent(new Event('announcements-read'))
    void actionMarkAnnouncementsRead().catch(() => {
      window.dispatchEvent(new Event('new-announcement'))
    })
  }

  return (
    <DashboardShell
      role="ADMIN"
      title="Communications"
      nav={ADMIN_NAV}
      pageAction={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isSuperAdmin && (
            <ContactDestinationSettingsButton
              destinationEmail={contactDestinationEmail}
              updateAction={updateContactDestination}
            />
          )}
          <Link
            href="/admin/announcements/about"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-secondary-container/40 bg-secondary-container/10 px-3.5 text-[12px] font-label-bold text-secondary transition hover:bg-secondary-container/20"
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            About Us profiles
          </Link>
          <button
            type="button"
            onClick={openNotificationHistory}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-secondary-container/40 bg-secondary-container/10 px-3.5 text-[12px] font-label-bold text-secondary transition hover:bg-secondary-container/20"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Notification history
            {historyBadge > 0 && (
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-primary">
                {historyBadge}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              resetSendForm()
              setModal('send')
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary-container px-3.5 text-[12px] font-label-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.25)] transition hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            Send notification
          </button>
        </div>
      }
    >
      <div className="space-y-5 p-4 md:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard icon="campaign" label="Notifications sent" value={String(announcements.length)} accent="orange" />
          <StatCard icon="mark_email_read" label="Emails delivered" value={String(totalSent)} />
          <StatCard icon="error" label="Emails failed" value={String(totalFailed)} accent={totalFailed > 0 ? 'red' : 'default'} />
        </section>
        {emailTestRecipient && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <span className="material-symbols-outlined text-[20px]">warning</span>
            <span>
              Until the group’s email domain is added, emails are delivered to {emailTestRecipient} only, not to each member.
            </span>
          </p>
        )}
        {contactInbox}
      </div>

      {modal === 'send' && (
        <Modal title="Send notification" icon="send" onClose={() => setModal(null)}>
          <form action={createAction} onSubmit={handleComposeSubmit} className="flex flex-col gap-4">
            <label className="text-sm font-semibold text-on-surface">
              Subject
              <input name="title" required placeholder="Notification subject" className="mt-1.5 block w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm" />
            </label>

            <label className="text-sm font-semibold text-on-surface">
              Message
              <textarea name="content" required rows={5} placeholder="Write your message…" className="mt-1.5 block w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm" />
            </label>

            <label className="text-sm font-semibold text-on-surface">
              Attachment <span className="font-normal text-on-surface-variant">(optional)</span>
              <input
                name="attachments"
                type="file"
                accept={ANNOUNCEMENT_ATTACHMENT_ACCEPT}
                onChange={handleAttachmentChange}
                className="mt-1.5 block w-full rounded-xl border border-outline-variant px-3 py-2 text-sm font-normal"
              />
            </label>

            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <label className="text-sm font-semibold text-on-surface">
                Category
                <select
                  name="audienceCategory"
                  value={audienceCategory}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm"
                >
                  <option value="">All members</option>
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-on-surface">Members</p>
                <button type="button" onClick={toggleSelectAll} className="text-xs font-bold text-primary">
                  {selectAllMembers ? 'Clear selection' : 'Select all'}
                </button>
              </div>
              {selectAllMembers && <input type="hidden" name="selectAll" value="true" />}
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-outline-variant/70 bg-surface p-2">
                {filteredMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      checked={selectAllMembers || selectedMemberIds.has(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{member.fullName}</span>
                    <span className="text-[10px] uppercase text-on-surface-variant">{ROLE_LABEL[member.role]}</span>
                    {!selectAllMembers && selectedMemberIds.has(member.id) && (
                      <input type="hidden" name="memberIds" value={member.id} />
                    )}
                  </label>
                ))}
                {!filteredMembers.length && <p className="px-2 py-3 text-sm text-on-surface-variant">No members in this category.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-on-surface">External emails</p>
                <button type="button" onClick={addExternalEmailField} className="text-xs font-bold text-primary">
                  + Add email
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {externalEmails.map((email, index) => (
                  <div key={`external-${index}`} className="flex gap-2">
                    <input
                      name="externalEmails"
                      type="email"
                      value={email}
                      onChange={(event) => updateExternalEmail(index, event.target.value)}
                      placeholder="name@example.com"
                      className="min-w-0 flex-1 rounded-xl border border-outline-variant px-3 py-2 text-sm"
                    />
                    {externalEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExternalEmail(index)}
                        className="rounded-full border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {attachmentError && <p className="text-sm font-semibold text-error">{attachmentError}</p>}

            <button type="submit" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary">
              Send notification
            </button>
          </form>
        </Modal>
      )}

      {modal === 'history' && (
        <Modal title="Notification history" icon="history" onClose={() => setModal(null)}>
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 40 }}>
                inbox
              </span>
              <p className="text-sm text-on-surface-variant">No notifications sent yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant">
                Emails sent: {totalSent} · Failed: {totalFailed}
              </p>
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
                      <form
                        action={async (formData) => {
                          await retryAction(formData)
                        }}
                      >
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
    </DashboardShell>
  )
}

function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,31,80,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-2xl dark:border-[#1a2d4f] dark:bg-[#0d1729]">
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-5 py-4 dark:border-[#1a2d4f]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-container/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>
                {icon}
              </span>
            </div>
            <h2 className="text-[15px] font-semibold text-on-surface dark:text-blue-50">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container dark:hover:bg-[#111f36]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
