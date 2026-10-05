'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import CampaignForm from '@/components/finance/CampaignForm'

export default function NewCampaignButton({ categories, today }: { categories: { id: string; name: string }[]; today: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-xs font-label-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] transition hover:opacity-90 active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        New campaign
      </button>
      <FullScreenModal open={open} title="New campaign" onClose={() => setOpen(false)} size="compact">
        <CampaignForm categories={categories} today={today} onSaved={() => setOpen(false)} />
      </FullScreenModal>
    </>
  )
}
