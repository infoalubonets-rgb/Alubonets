'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'

export default function LedgerHistoryModal({ open, closeHref, children }: { open: boolean; closeHref: string; children: ReactNode }) {
  const router = useRouter()
  const [visible, setVisible] = useState(open)
  useEffect(() => setVisible(open), [open])
  const close = () => {
    setVisible(false)
    if (open) router.push(closeHref, { scroll: false })
  }
  return <>
    <button type="button" onClick={() => setVisible(true)} className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-container px-4 text-xs font-semibold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] hover:opacity-90">
      <span className="material-symbols-outlined text-[20px]">receipt_long</span>Transaction history
    </button>
    <FullScreenModal open={visible} title="Transaction history" size="xl" onClose={close}>{children}</FullScreenModal>
  </>
}
