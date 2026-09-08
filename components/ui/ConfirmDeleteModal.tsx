'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Branded delete confirmation — use instead of window.confirm. */
export default function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmLabel = 'Yes, delete',
  cancelLabel = 'Cancel',
  pending = false,
  onCancel,
  onConfirm,
}: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pending, onCancel])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[150] grid place-items-center bg-[#001f50]/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface shadow-2xl dark:border-[#1a2d4f] dark:bg-[#0a1628]"
      >
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary-container to-primary" aria-hidden />
        <div className="p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40">
            <span className="material-symbols-outlined text-[26px]">delete_forever</span>
          </span>
          <h3 id="confirm-delete-title" className="mt-4 font-h3 text-xl text-primary dark:text-primary-fixed-dim">
            {title}
          </h3>
          <div id="confirm-delete-description" className="mt-2 text-sm leading-6 text-on-surface-variant">
            {description}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? 'Deleting…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
