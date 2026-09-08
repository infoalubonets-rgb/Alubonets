'use client'

import { useState, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

type Props = {
  icon: string
  label: string
  title: string
  size?: 'full' | 'compact'
  /** Show the label as visible text next to the icon, instead of an icon-only circular button. */
  showText?: boolean
  children: ReactNode
}

export default function IconModalButton({ icon, label, title, size = 'compact', showText = false, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className={
          showText
            ? 'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary shadow-[0_3px_10px_rgba(0,31,80,0.12)] transition hover:border-primary hover:bg-primary hover:text-on-primary'
            : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary shadow-[0_3px_10px_rgba(0,31,80,0.12)] transition hover:border-primary hover:bg-primary hover:text-on-primary'
        }
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {showText && label}
      </button>

      <FullScreenModal open={open} title={title} onClose={() => setOpen(false)} size={size}>
        {children}
      </FullScreenModal>
    </>
  )
}
