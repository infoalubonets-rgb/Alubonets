'use client'

import { useState, useTransition } from 'react'
import { actionDeleteAnnouncement } from '@/app/actions/domain'
import AnnouncementComposer from './AnnouncementComposer'

type Announcement = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  publishedAt: Date
  broadcast: boolean
  emailSentAt: Date | null
  expiresAt: Date | null
  authorId: string
  author: { fullName: string }
  receipts: { readAt: Date | null }[]
}

type MemberOption = { id: string; fullName: string; email: string }

export default function AnnouncementsClient({
  announcements,
  currentUserId,
  isSuperAdmin,
  canSend = false,
  members = [],
}: {
  announcements: Announcement[]
  currentUserId: string
  isSuperAdmin: boolean
  canSend?: boolean
  members?: MemberOption[]
}) {
  const [items, setItems] = useState(announcements)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    setDeleting(null)
    setItems((prev) => prev.filter((a) => a.id !== id))
    startTransition(() => { actionDeleteAnnouncement(id) })
  }

  const now = new Date()

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold text-[#001f50] dark:text-blue-50">
            Notifications
          </h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5">
            {items.length} announcement{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canSend && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#fe8015] text-white text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              add
            </span>
            New notification
          </button>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <span className="material-symbols-outlined text-[56px] text-primary/15">campaign</span>
          <p className="text-[15px] font-semibold text-on-surface">No announcements yet</p>
          <p className="text-[13px] text-on-surface-variant">
            You'll see group announcements here.
          </p>
        </div>
      )}

      {/* Announcements list — always rendered */}
      <div className="space-y-3">
        {items.map((a) => {
          const unread = a.receipts[0]?.readAt === null
          const isOwner = a.authorId === currentUserId
          const canDel = isOwner || isSuperAdmin
          const isExpired = a.expiresAt && new Date(a.expiresAt) < now

          return (
            <div
              key={a.id}
              className={`rounded-2xl border bg-surface shadow-sm overflow-hidden transition-all ${
                unread
                  ? 'border-primary/30 ring-1 ring-primary/10'
                  : 'border-outline-variant/60'
              }`}
            >
              {/* Expiry reminder banner — only shown to the author when overdue */}
              {isOwner && isExpired && (
                <div className="flex items-center gap-2 px-5 py-2 bg-orange-50 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-800/40">
                  <span className="material-symbols-outlined icon-fill text-orange-500 text-[16px]">
                    alarm
                  </span>
                  <p className="text-[12px] font-semibold text-orange-700 dark:text-orange-300 flex-1">
                    This announcement was due for removal on{' '}
                    {new Date(a.expiresAt!).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    . Please delete it when no longer needed.
                  </p>
                </div>
              )}

              {/* Header row */}
              <div
                className={`flex items-start justify-between gap-3 px-5 py-4 ${unread ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-1 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                      unread ? 'bg-primary/15' : 'bg-surface-container'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined icon-fill text-[17px] ${unread ? 'text-primary' : 'text-outline'}`}
                    >
                      campaign
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {unread && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary text-on-primary px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                      {a.emailSentAt && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
                            mark_email_read
                          </span>
                          Emailed
                        </span>
                      )}
                      {isExpired && isOwner && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                          <span
                            className="material-symbols-outlined icon-fill"
                            style={{ fontSize: 10 }}
                          >
                            alarm
                          </span>
                          Overdue
                        </span>
                      )}
                      <p className="text-[14px] font-bold text-on-surface leading-snug">
                        {a.title}
                      </p>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      <span className="font-medium">By {a.author.fullName}</span>
                      {' · '}
                      {new Date(a.publishedAt).toLocaleDateString('en-KE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {!a.broadcast && ' · sent to you'}
                    </p>
                  </div>
                </div>

                {canDel && (
                  <div className="flex-shrink-0 relative">
                    {deleting === a.id ? (
                      <div className="absolute right-0 top-0 z-10 bg-surface border border-outline-variant rounded-xl shadow-lg p-3 w-48">
                        <p className="text-[12px] font-semibold text-on-surface mb-2">
                          Delete this announcement?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white py-1.5 text-[11px] font-bold transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(null)}
                            className="flex-1 rounded-lg border border-outline-variant bg-surface-container text-on-surface py-1.5 text-[11px] font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleting(a.id)}
                        className="text-outline hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                        title="Delete announcement"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                          delete
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Content + optional image */}
              <div className="px-5 pb-4 pt-1">
                <p className="text-[14px] text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                  {a.content}
                </p>
                {a.imageUrl && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-outline-variant/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="w-full max-h-72 object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* New notification modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant dark:border-[#1a2d4f] bg-[#fe8015]/8 dark:bg-[#fe8015]/10">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined icon-fill text-[#fe8015]"
                  style={{ fontSize: 18 }}
                >
                  campaign
                </span>
                <h2 className="font-bold text-[14px] text-[#001f50] dark:text-blue-50">
                  New notification
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  close
                </span>
              </button>
            </div>
            {/* Modal body */}
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 64px)' }}>
              <AnnouncementComposer
                members={members}
                onSuccess={() => setModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
