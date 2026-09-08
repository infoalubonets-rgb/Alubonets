'use client'

import { useState, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

type Props = {
  icon: string
  label: string
  title: string
  size?: 'full' | 'compact'
  children: ReactNode
}

export default function IconModalButton({ icon, label, title, size = 'compact', children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary shadow-[0_3px_10px_rgba(0,31,80,0.12)] transition hover:border-primary hover:bg-primary hover:text-on-primary"
      >
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </button>

      <FullScreenModal open={open} title={title} onClose={() => setOpen(false)} size={size}>
        {children}
      </FullScreenModal>
    </>
  )
}
