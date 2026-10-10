'use client'

import { useState, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

type CloseApi = { close: () => void; reopen: () => void }

type Props = {
  icon: string
  label: string
  title: string
  size?: 'full' | 'compact' | 'wide'
  /** Show the label as visible text next to the icon, instead of an icon-only circular button. */
  showText?: boolean
  variant?: 'default' | 'primary' | 'orange'
  /** Open on first render, e.g. when a link points straight at this section. */
  defaultOpen?: boolean
  children: ReactNode | ((api: CloseApi) => ReactNode)
}

export default function IconModalButton({ icon, label, title, size = 'compact', showText = false, variant = 'default', defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const close = () => setOpen(false)
  const reopen = () => setOpen(true)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className={
          showText && variant === 'orange'
            ? 'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-container px-4 text-xs font-semibold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] transition hover:opacity-90'
            : showText && variant === 'primary'
            ? 'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 text-xs font-semibold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] transition hover:bg-secondary-container'
            : showText
            ? 'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary shadow-[0_3px_10px_rgba(0,31,80,0.12)] transition hover:border-primary hover:bg-primary hover:text-on-primary'
            : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary shadow-[0_3px_10px_rgba(0,31,80,0.12)] transition hover:border-primary hover:bg-primary hover:text-on-primary'
        }
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {showText && label}
      </button>

      <FullScreenModal open={open} title={title} onClose={close} size={size}>
        {typeof children === 'function' ? children({ close, reopen }) : children}
      </FullScreenModal>
    </>
  )
}
