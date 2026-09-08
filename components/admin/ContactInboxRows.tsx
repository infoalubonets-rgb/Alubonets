'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import FullScreenModal from '@/components/ui/FullScreenModal'
import {
  deleteContactMessage,
  deleteSelectedContactMessages,
  replyToContact,
  updateContactWorkflow,
} from '@/app/actions/contact'

export type ContactInboxMessage = {
  id: string
  name: string
  email: string
  phone: string | null
  category: string | null
  message: string
  status: string
  emailStatus: string
  createdAt: string
  replies: {
    id: string
    subject: string
    body: string
    sentAt: string
    deliveryStatus: string
  }[]
}

function statusTone(status: string) {
  if (status === 'UNREAD') return 'bg-secondary-container/15 text-secondary'
  if (status === 'RESOLVED') return 'bg-primary/10 text-primary'
  if (status === 'SPAM') return 'bg-error/10 text-error'
  return 'bg-surface-container-high text-on-surface-variant'
}

function ReplySuccessToast({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(onClose, 2200)
    return () => window.clearTimeout(timer)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="contact-success-backdrop pointer-events-none fixed inset-x-0 bottom-6 z-[140] flex justify-center px-4">
      <div className="contact-success-card pointer-events-auto flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface px-4 py-3 shadow-2xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[22px]">check</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Reply sent</p>
          <p className="text-xs text-on-surface-variant">The enquiry was marked in progress.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function ContactInboxRows({ messages: initialMessages }: { messages: ContactInboxMessage[] }) {
  const [messages, setMessages] = useState(initialMessages)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [statusPending, startStatusTransition] = useTransition()
  const [replyPending, startReplyTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [replySuccess, setReplySuccess] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const replyFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  const selected = selectedId ? messages.find((message) => message.id === selectedId) || null : null
  const unread = messages.filter((message) => message.status === 'UNREAD').length
  const allChecked = messages.length > 0 && checked.size === messages.length

  function patchMessage(id: string, patch: Partial<ContactInboxMessage>) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)))
  }

  function toggleChecked(id: string) {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllChecked() {
    if (allChecked) setChecked(new Set())
    else setChecked(new Set(messages.map((message) => message.id)))
  }

  function removeMessages(ids: string[]) {
    const remove = new Set(ids)
    setMessages((current) => current.filter((message) => !remove.has(message.id)))
    setChecked((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.delete(id))
      return next
    })
    if (selectedId && remove.has(selectedId)) setSelectedId(null)
  }

  function deleteOne(id: string) {
    if (!window.confirm('Delete this enquiry permanently?')) return
    setActionError(null)
    const formData = new FormData()
    formData.set('id', id)
    startDeleteTransition(async () => {
      const result = await deleteContactMessage(formData)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      removeMessages([id])
    })
  }

  function deleteChecked() {
    setActionError(null)
    const formData = new FormData()
    Array.from(checked).forEach((id) => formData.append('ids', id))
    startDeleteTransition(async () => {
      const result = await deleteSelectedContactMessages(formData)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      removeMessages(Array.from(checked))
      setConfirmBulkDelete(false)
    })
  }

  function openDetails(message: ContactInboxMessage) {
    setSelectedId(message.id)
    setActionError(null)
    setStatusNotice(null)
    if (message.status === 'UNREAD') {
      const formData = new FormData()
      formData.set('id', message.id)
      formData.set('status', 'IN_PROGRESS')
      startStatusTransition(async () => {
        const result = await updateContactWorkflow(formData)
        if (result.ok) patchMessage(message.id, { status: result.status })
      })
    }
  }

  function onUpdateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const formData = new FormData(event.currentTarget)
    setActionError(null)
    setStatusNotice(null)
    startStatusTransition(async () => {
      const result = await updateContactWorkflow(formData)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      patchMessage(selected.id, { status: result.status })
      setStatusNotice(`Status updated to ${result.status.replaceAll('_', ' ')}.`)
    })
  }

  function onSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const formData = new FormData(event.currentTarget)
    setActionError(null)
    startReplyTransition(async () => {
      const result = await replyToContact(formData)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      patchMessage(selected.id, {
        status: 'IN_PROGRESS',
        replies: [result.reply, ...selected.replies],
      })
      replyFormRef.current?.reset()
      if (replyFormRef.current) {
        const subject = replyFormRef.current.elements.namedItem('subject') as HTMLInputElement | null
        if (subject) subject.value = `Re: ${selected.category || 'Your Alubonets enquiry'}`
      }
      setReplySuccess(true)
    })
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-h3 text-lg text-primary">Contact inbox</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Public contact form messages land here and are emailed with the Alubonets enquiry template.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{unread} unread</span>
          <button
            type="button"
            disabled={!checked.size || deletePending}
            onClick={() => setConfirmBulkDelete(true)}
            className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Delete selected
          </button>
        </div>
      </header>

      {actionError && !selected && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        {messages.length > 0 && (
          <label className="flex items-center gap-2 border-b border-outline-variant/60 px-4 py-2.5 text-xs font-semibold text-on-surface-variant sm:px-5">
            <input type="checkbox" checked={allChecked} onChange={toggleAllChecked} className="h-4 w-4 accent-primary" />
            Select all
          </label>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className="flex flex-wrap items-center gap-3 border-b border-outline-variant/60 px-4 py-3 last:border-b-0 sm:px-5"
          >
            <input
              type="checkbox"
              checked={checked.has(message.id)}
              onChange={() => toggleChecked(message.id)}
              aria-label={`Select enquiry from ${message.name}`}
              className="h-4 w-4 accent-primary"
            />
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone(message.status)}`}>
              {message.status.replaceAll('_', ' ')}
            </span>
            <span className="material-symbols-outlined text-primary">mail</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-on-surface">{message.name}</p>
              <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                {message.email}
                {message.phone ? ` · ${message.phone}` : ''}
                {' · '}
                {message.category || 'General'}
                {' · '}
                {new Date(message.createdAt).toLocaleString('en-KE')}
              </p>
            </div>
            <span className="hidden text-[11px] text-on-surface-variant sm:inline">Forward: {message.emailStatus}</span>
            <button
              type="button"
              onClick={() => openDetails(message)}
              aria-label={`View details for ${message.name}`}
              title="View details"
              className="grid h-9 w-9 place-items-center rounded-full border border-primary/25 text-primary transition hover:bg-primary/5"
            >
              <span className="material-symbols-outlined text-[19px]">visibility</span>
            </button>
            <button
              type="button"
              disabled={deletePending}
              onClick={() => deleteOne(message.id)}
              aria-label={`Delete enquiry from ${message.name}`}
              title="Delete"
              className="grid h-9 w-9 place-items-center rounded-full border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[19px]">delete</span>
            </button>
          </div>
        ))}
        {!messages.length && (
          <p className="p-8 text-center text-sm text-on-surface-variant">
            No enquiries yet. Messages sent from the public Contact page will appear here.
          </p>
        )}
      </div>

      <FullScreenModal
        open={Boolean(selected)}
        title={selected ? selected.name : 'Enquiry'}
        onClose={() => setSelectedId(null)}
        size="compact"
      >
        {selected && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-on-surface">{selected.name}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    <a href={`mailto:${selected.email}`} className="text-primary underline-offset-2 hover:underline">
                      {selected.email}
                    </a>
                    {selected.phone ? ` · ${selected.phone}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {selected.category || 'General'} · {new Date(selected.createdAt).toLocaleString('en-KE')} · Forward:{' '}
                    {selected.emailStatus}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selected.status)}`}>
                  {selected.status.replaceAll('_', ' ')}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm leading-relaxed text-on-surface">
                {selected.message}
              </p>
            </div>

            {actionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
            {statusNotice && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{statusNotice}</div>
            )}

            <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-outline-variant/60 bg-surface p-4">
              <form onSubmit={onUpdateStatus} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={selected.id} />
                <label className="text-xs font-semibold text-on-surface">
                  Status
                  <select
                    name="status"
                    key={`${selected.id}-${selected.status}`}
                    defaultValue={selected.status}
                    disabled={statusPending || replyPending}
                    className="mt-1 block rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm"
                  >
                    {['UNREAD', 'IN_PROGRESS', 'RESOLVED', 'SPAM'].map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={statusPending || replyPending}
                  className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-60"
                >
                  {statusPending ? 'Updating…' : 'Update'}
                </button>
              </form>
            </div>

            <form
              ref={replyFormRef}
              onSubmit={onSendReply}
              className="grid gap-3 rounded-2xl border border-outline-variant/60 bg-surface p-4"
            >
              <input type="hidden" name="id" value={selected.id} />
              <p className="text-sm font-semibold text-on-surface">Send reply</p>
              <input
                name="subject"
                required
                defaultValue={`Re: ${selected.category || 'Your Alubonets enquiry'}`}
                disabled={replyPending || statusPending}
                className="rounded-xl border border-outline-variant px-3 py-2.5 text-sm disabled:opacity-60"
              />
              <textarea
                name="body"
                required
                rows={4}
                placeholder="Write an email reply…"
                disabled={replyPending || statusPending}
                className="rounded-xl border border-outline-variant px-3 py-2.5 text-sm disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={replyPending || statusPending}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
              >
                {replyPending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Sending…
                  </>
                ) : (
                  'Send reply'
                )}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={deletePending || replyPending || statusPending}
                onClick={() => deleteOne(selected.id)}
                className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                {deletePending ? 'Deleting…' : 'Delete enquiry'}
              </button>
            </div>

            {selected.replies.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-outline-variant/60 bg-surface p-4">
                <p className="text-sm font-semibold text-on-surface">
                  {selected.replies.length} tracked repl{selected.replies.length === 1 ? 'y' : 'ies'}
                </p>
                {selected.replies.map((reply) => (
                  <div key={reply.id} className="rounded-xl bg-surface-container-low p-3 text-sm">
                    <p className="font-semibold">{reply.subject}</p>
                    <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{reply.body}</p>
                    <p className="mt-2 text-[11px] text-on-surface-variant">
                      {new Date(reply.sentAt).toLocaleString('en-KE')} · {reply.deliveryStatus}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FullScreenModal>

      <ReplySuccessToast open={replySuccess} onClose={() => setReplySuccess(false)} />

      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-[140] grid place-items-center bg-[#001f50]/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletePending) setConfirmBulkDelete(false)
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
            <h3 className="font-h3 text-xl text-on-surface">Delete selected enquiries?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Permanently delete <strong>{checked.size}</strong> enquir{checked.size === 1 ? 'y' : 'ies'} from the
              contact inbox.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deletePending}
                onClick={() => setConfirmBulkDelete(false)}
                className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={deleteChecked}
                className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletePending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
