'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { actionDeleteMeeting } from '@/app/actions/meetings'

export default function DeleteDraftMeetingButton({
  meetingId,
  meetingTitle,
  compact = false,
}: {
  meetingId: string
  meetingTitle: string
  compact?: boolean
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const remove = () => {
    setError('')
    startTransition(async () => {
      try {
        await actionDeleteMeeting(meetingId)
        setConfirming(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete the meeting')
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5" onClick={(event) => event.stopPropagation()}>
        <span className="max-w-48 text-right text-[11px] font-medium text-red-600">
          Delete “{meetingTitle}”?
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false)
              setError('')
            }}
            disabled={pending}
            className="rounded-lg border border-outline-variant px-2.5 py-1.5 text-[11px] font-semibold text-on-surface hover:bg-surface-container"
          >
            Cancel
          </button>
        </div>
        {error && <span className="max-w-48 text-right text-[10px] text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={
        compact
          ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30'
          : 'inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30'
      }
      title="Delete draft meeting"
      aria-label={`Delete draft meeting ${meetingTitle}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
      {!compact && 'Delete'}
    </button>
  )
}
