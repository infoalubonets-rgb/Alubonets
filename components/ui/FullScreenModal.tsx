'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** `full` has a fixed height; `compact` and `wide` shrink to fit their content; `xl` fills almost the whole screen. */
  size?: 'full' | 'compact' | 'wide' | 'xl'
}

export default function FullScreenModal({ open, title, onClose, children, size = 'full' }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted || !open) return null

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
      <div className={`flex w-full flex-col overflow-hidden border border-outline-variant/60 bg-surface shadow-2xl dark:bg-[#0a1628] ${
        size === 'compact'
          ? 'max-h-[90dvh] max-w-2xl rounded-t-3xl sm:rounded-3xl'
          : size === 'wide'
            ? 'max-h-[90dvh] max-w-5xl rounded-t-3xl sm:rounded-3xl'
            : size === 'xl'
              ? 'h-[96dvh] max-w-[min(96vw,1440px)] rounded-t-3xl sm:rounded-3xl'
            : 'h-[min(96dvh,920px)] max-w-5xl rounded-t-3xl sm:rounded-3xl'
      }`}>
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
