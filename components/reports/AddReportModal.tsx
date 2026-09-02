'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

export default function AddReportModal({
  uploadAction,
}: {
  uploadAction: (formData: FormData) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-label-bold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] transition hover:bg-secondary-container"
      >
        <span className="material-symbols-outlined text-[19px]">add_circle</span>
        Add new report
      </button>

      <FullScreenModal open={open} title="Add new report" onClose={() => setOpen(false)} size="compact">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-5 rounded-2xl bg-primary/5 p-4">
            <h3 className="font-h3 text-lg text-primary">Upload a report</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Add the report information and choose whether to save it as a draft or publish it now.
            </p>
          </div>

          <form action={uploadAction} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold text-on-surface">
              Report title
              <input
                name="title"
                required
                autoFocus
                placeholder="Enter report title"
                className="block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-on-surface">
              Report file
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                className="block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-semibold file:text-primary"
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-on-surface sm:col-span-2">
              Description or comments
              <textarea
                name="description"
                rows={5}
                placeholder="Add a short description or comments about this report"
                className="block w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <p className="text-xs text-on-surface-variant sm:col-span-2">
              Accepted formats: PDF, Word, Excel, and CSV. Maximum file size: 15 MB.
            </p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/60 pt-4 sm:col-span-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface">
                Cancel
              </button>
              <button name="status" value="DRAFT" className="rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary">
                Save draft
              </button>
              <button name="status" value="PUBLISHED" className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2.5 text-sm font-label-bold text-on-primary shadow-sm">
                <span className="material-symbols-outlined text-[17px]">publish</span>
                Publish report
              </button>
            </div>
          </form>
        </div>
      </FullScreenModal>
    </>
  )
}
