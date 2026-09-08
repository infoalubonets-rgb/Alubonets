'use client'

import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  choice: 'APPROVE' | 'REJECT' | null
  onClose: () => void
}

export default function VoteSuccessDialog({ open, choice, onClose }: Props) {
  if (!open || !choice || typeof document === 'undefined') return null

  const approve = choice === 'APPROVE'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-success-title"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[#001f50]/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            approve ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
          }`}
        >
          <span className="material-symbols-outlined text-[26px]">check_circle</span>
        </div>
        <h3 id="vote-success-title" className="mt-4 font-h3 text-lg text-primary">
          {approve ? 'Approval submitted' : 'Opposition submitted'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          Your vote has been recorded and cannot be changed. You can still view your response below.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
