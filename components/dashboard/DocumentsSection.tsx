'use client'

import { useState, useTransition } from 'react'
import { actionDeleteDocument } from '@/app/actions/domain'

type Doc = {
  id: string
  title: string
  fileUrl: string
  category: string | null
  uploadedAt: Date
  uploader: { fullName: string } | null
}

export default function DocumentsSection({ documents: initial }: { documents: Doc[] }) {
  const [docs, setDocs] = useState(initial)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    setConfirmId(null)
    setDocs((prev) => prev.filter((d) => d.id !== id))
    startTransition(() => actionDeleteDocument(id))
  }

  return (
    <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60 dark:border-[#1a2d4f] bg-[#fe8015]/6 dark:bg-[#fe8015]/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined icon-fill text-[#fe8015]" style={{ fontSize: 17 }}>folder_open</span>
          <h2 className="font-bold text-[12px] text-[#fe8015] uppercase tracking-widest">Documents</h2>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-[#fe8015]/15 text-[#fe8015] text-[10px] font-bold">
          {docs.length}
        </span>
      </div>

      {docs.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline/40">description</span>
          <p className="text-[13px] text-on-surface-variant mt-2">No documents yet. Publish a meeting to create one.</p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant/40 dark:divide-[#1a2d4f]">
          {docs.slice(0, 5).map((d) => (
            <li key={d.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-container/50 dark:hover:bg-[#111f36]/60 transition-colors group">
              {/* Icon */}
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#fe8015]/10 border border-[#fe8015]/20 dark:border-[#fe8015]/30 flex items-center justify-center">
                <span className="material-symbols-outlined icon-fill text-[#fe8015]" style={{ fontSize: 17 }}>description</span>
              </div>

              {/* Info */}
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <p className="text-[13px] font-semibold text-on-surface dark:text-blue-50 truncate group-hover:text-[#fe8015] transition-colors">
                  {d.title}
                </p>
                <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 mt-0.5">
                  {d.uploader?.fullName ?? 'Unknown'}
                  {' · '}
                  {new Date(d.uploadedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </a>

              {/* Category */}
              {d.category && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#001f50]/8 dark:bg-[#001f50]/30 text-[#001f50] dark:text-blue-300">
                  {d.category}
                </span>
              )}

              {/* Delete confirm popover */}
              {confirmId === d.id && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2 z-20 bg-surface border border-outline-variant dark:border-[#1e3461] rounded-xl shadow-xl p-3 w-44">
                  <p className="text-[12px] font-semibold text-on-surface mb-2">Delete this document?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white py-1.5 text-[11px] font-bold transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="flex-1 rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface-container text-on-surface py-1.5 text-[11px] font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Delete button */}
              <button
                type="button"
                onClick={() => setConfirmId(confirmId === d.id ? null : d.id)}
                className="flex-shrink-0 p-1.5 rounded-lg text-outline/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Delete document"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
