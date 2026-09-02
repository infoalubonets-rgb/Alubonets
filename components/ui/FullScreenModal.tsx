'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export default function FullScreenModal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-modal-title"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#001f50]/55 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex h-[min(96dvh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-outline-variant/60 bg-surface shadow-2xl dark:bg-[#0a1628] sm:rounded-3xl">
        <header className="flex shrink-0 items-center gap-2 border-b border-outline-variant/70 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Go back"
            className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h2 id="fullscreen-modal-title" className="min-w-0 flex-1 truncate font-h3 text-lg text-primary dark:text-primary-fixed-dim">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
