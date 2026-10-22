'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'

type Props = {
  destinationEmail: string
  updateAction: (formData: FormData) => Promise<void>
}

export default function ContactDestinationSettingsButton({ destinationEmail, updateAction }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [emails, setEmails] = useState(() => destinationEmail.split(/[,;\n]/).map((email) => email.trim()).filter(Boolean))

  const openModal = () => {
    setError('')
    setSaved('')
    setEmails(destinationEmail.split(/[,;\n]/).map((email) => email.trim()).filter(Boolean))
    setOpen(true)
  }

  const save = (formData: FormData) => {
    setError('')
    setSaved('')
    startTransition(async () => {
      try {
        const destinations = formData.getAll('email').map(String).map((email) => email.trim()).filter(Boolean)
        formData.set('email', destinations.join(', '))
        await updateAction(formData)
        setSaved(`Saved — Contact Us messages now go to ${destinations.length} inbox${destinations.length === 1 ? '' : 'es'}.`)
        router.refresh()
        setTimeout(() => setOpen(false), 1400)
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : 'Could not save the email. Please try again.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
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
              Contact Us form submissions are emailed to every address listed here.
            </p>
          </div>

          <form action={save} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-on-surface">Destination emails</p>
              {emails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Destination email {index + 1}</span>
                    <input name="email" type="email" required value={email}
                      onChange={(event) => setEmails((current) => current.map((value, i) => i === index ? event.target.value : value))}
                      className="block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  </label>
                  {emails.length > 1 && <button type="button" onClick={() => setEmails((current) => current.filter((_, i) => i !== index))}
                    className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-error" aria-label={`Remove email ${index + 1}`}>Remove</button>}
                </div>
              ))}
              <button type="button" disabled={emails.length >= 20} onClick={() => setEmails((current) => [...current, ''])}
                className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">+ Add another email</button>
              <p className="text-xs text-on-surface-variant">Up to 20 addresses. Each will receive the enquiry.</p>
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container/40 px-3 py-2 text-sm text-error">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </p>
            )}
            {saved && !error && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-medium text-green-800">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {saved}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </FullScreenModal>
    </>
  )
}
