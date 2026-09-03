'use client'

import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  choice: 'APPROVE' | 'REJECT' | null
  pending: boolean
  hasComment: boolean
  allowComments: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function VoteConfirmDialog({
  open,
  choice,
  pending,
  hasComment,
  allowComments,
  onCancel,
  onConfirm,
}: Props) {
  if (!open || !choice || typeof document === 'undefined') return null

  const approve = choice === 'APPROVE'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-confirm-title"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[#001f50]/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            approve ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
          }`}
        >
          <span className="material-symbols-outlined text-[26px]">
            {approve ? 'thumb_up' : 'thumb_down'}
          </span>
        </div>
        <h3 id="vote-confirm-title" className="mt-4 font-h3 text-lg text-primary">
          {approve ? 'Submit your approval?' : 'Submit your opposition?'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          Once submitted, your vote is <strong className="text-on-surface">final and cannot be changed</strong>.
          {allowComments
            ? hasComment
              ? ' Your comment will be saved with this vote.'
              : ' You can still add an optional comment before confirming.'
            : ''}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low disabled:opacity-50"
          >
            Go back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50 ${
              approve ? 'bg-primary' : 'bg-error'
            }`}
          >
            {pending ? 'Submitting…' : approve ? 'Yes, approve' : 'Yes, oppose'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
