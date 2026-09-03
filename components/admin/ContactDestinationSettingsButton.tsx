'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

type Props = {
  destinationEmail: string
  updateAction: (formData: FormData) => Promise<void>
}

export default function ContactDestinationSettingsButton({ destinationEmail, updateAction }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Contact form settings"
        aria-label="Contact form settings"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary shadow-[0_3px_10px_rgba(0,31,80,0.12)] transition hover:border-primary hover:bg-primary hover:text-on-primary"
      >
        <span className="material-symbols-outlined text-[22px]">settings</span>
      </button>

      <FullScreenModal open={open} title="Contact form settings" onClose={() => setOpen(false)} size="compact">
        <div className="mx-auto w-full max-w-lg space-y-5">
          <div className="rounded-2xl bg-primary/5 p-4">
            <h3 className="font-h3 text-lg text-primary">Public enquiry inbox</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Contact Us form submissions are emailed to this address.
            </p>
          </div>

          <form
            action={async (formData) => {
              await updateAction(formData)
              setOpen(false)
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-semibold text-on-surface">
              Destination email
              <input
                name="email"
                type="email"
                required
                defaultValue={destinationEmail}
                className="mt-1.5 block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)]"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </FullScreenModal>
    </>
  )
}
