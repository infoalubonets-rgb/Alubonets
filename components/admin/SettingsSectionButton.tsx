'use client'

import { useState, type ReactNode } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

type Props = {
  title: string
  description?: string
  icon?: string
  children: ReactNode
}

export default function SettingsSectionButton({ title, description, icon = 'settings', children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-start gap-2 rounded-2xl border border-outline-variant/60 bg-surface p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"
      >
        <span className="material-symbols-outlined text-2xl text-primary">{icon}</span>
        <span className="font-h3 text-lg text-primary">{title}</span>
        {description && <span className="text-xs text-on-surface-variant">{description}</span>}
      </button>

      <FullScreenModal open={open} title={title} onClose={() => setOpen(false)} size="compact">
        <div className="mx-auto w-full max-w-2xl space-y-5">{children}</div>
      </FullScreenModal>
    </>
  )
}
