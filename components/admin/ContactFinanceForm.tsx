'use client'

import { useState } from 'react'
import { updateContactFinanceSettings } from '@/app/actions/settings'

type Props = {
  publicEmail: string
  publicPhone: string
  enquiryEmail: string
  approvalThreshold: string
}

export default function ContactFinanceForm({
  publicEmail,
  publicPhone,
  enquiryEmail,
  approvalThreshold,
}: Props) {
  const [email, setEmail] = useState(publicEmail)
  const [phone, setPhone] = useState(publicPhone)
  const [forwardTo, setForwardTo] = useState(enquiryEmail)
  const [threshold, setThreshold] = useState(approvalThreshold)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function saveAll(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setMessage(null)
    setError(null)

    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()
    const trimmedForward = forwardTo.trim()
    const trimmedThreshold = threshold.trim()

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid footer contact email.')
      return
    }
    if (trimmedPhone && !/^[+0-9()\-\s]{7,40}$/.test(trimmedPhone)) {
      setError('Enter a valid phone number, or leave it blank.')
      return
    }
    if (!trimmedForward || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedForward)) {
      setError('Enter a valid enquiry forwarding email.')
      return
    }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmedThreshold)) {
      setError('Approval threshold must be a number in KES.')
      return
    }

    setSaving(true)
    try {
      const result = await updateContactFinanceSettings({
        publicEmail: trimmedEmail,
        publicPhone: trimmedPhone,
        enquiryEmail: trimmedForward,
        approvalThreshold: trimmedThreshold,
      })
      if (result.ok) {
        setMessage('Contact and finance settings saved.')
      } else {
        setError(result.error)
      }
    } catch {
      setError('Could not save settings. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={saveAll} className="space-y-5">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">Public contact details</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Shown in the site footer and on the Contact page.
          </p>
        </div>
        <label className="block text-sm">
          Footer / contact email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="info@example.com"
          />
        </label>
        <label className="block text-sm">
          Footer / contact phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="+254 7XX XXX XXX"
          />
        </label>
      </div>

      <div className="space-y-3 border-t border-outline-variant/60 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-primary">Enquiry forwarding</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Contact Us form messages are emailed to this address.
          </p>
        </div>
        <label className="block text-sm">
          Forward enquiries to
          <input
            type="email"
            value={forwardTo}
            onChange={(e) => setForwardTo(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="enquiries@example.com"
          />
        </label>
      </div>

      <div className="space-y-3 border-t border-outline-variant/60 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-primary">Finance</h3>
        </div>
        <label className="block text-sm">
          Financial approval threshold (KES)
          <input
            type="text"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <p className="text-xs text-green-700">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </form>
  )
}
