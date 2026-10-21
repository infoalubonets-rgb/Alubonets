'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import CreateEventForm from './CreateEventForm'

type MemberOption = { id: string; fullName: string; email: string }

/** "Add event" header button that opens the create-event form in a modal. */
export default function AddEventButton({ members }: { members: MemberOption[] }) {
  const [open, setOpen] = useState(false)
  // The create action revalidates this page, so the new card appears once it saves.
  function handleAdded() {
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-primary text-on-primary px-4 py-2 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
      >
        <span className="material-symbols-outlined icon-fill" style={{ fontSize: 18 }}>add</span>
        Add event
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>add_circle</span>
                </div>
                <div>
                  <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Create event</h2>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50">
                    Add a cover photo and choose who sees it
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-surface-container dark:hover:bg-[#111f36] text-on-surface-variant dark:text-blue-200/60 transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <CreateEventForm onOptimisticAdd={handleAdded} members={members} />
          </div>
        </div>
      , document.body)}
    </>
  )
}
