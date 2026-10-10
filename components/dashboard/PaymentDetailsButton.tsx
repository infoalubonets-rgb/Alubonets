'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import OfficialPaymentDestination, { type PaymentDestination } from '@/components/dashboard/OfficialPaymentDestination'

export default function PaymentDetailsButton({ destination }: { destination: PaymentDestination | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-sm font-semibold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] transition hover:opacity-90 active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">account_balance</span>
        Payment details
      </button>
      <FullScreenModal open={open} title="Payment details" onClose={() => setOpen(false)} size="compact">
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Pay only to these official details and use your name or membership number as the reference.
          </p>
          <OfficialPaymentDestination destination={destination} />
          <div className="flex flex-wrap justify-end gap-2">
            <a
              href="/api/pdf/payment-details"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-primary px-4 text-sm font-semibold text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              View PDF
            </a>
            <a
              href="/api/pdf/payment-details?download=1"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download PDF
            </a>
          </div>
        </div>
      </FullScreenModal>
    </>
  )
}
