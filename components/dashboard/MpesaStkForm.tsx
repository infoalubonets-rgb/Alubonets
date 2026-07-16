'use client'

import { useState } from 'react'

export default function MpesaStkForm() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setLoading(true)
        setStatus('')
        try {
          const fd = new FormData(e.currentTarget)
          const res = await fetch('/api/mpesa/stk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: fd.get('phone'),
              amount: Number(fd.get('amount')),
              userId: fd.get('userId') || undefined,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'STK failed')
          setStatus(data.CustomerMessage || 'STK initiated')
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'STK failed')
        } finally {
          setLoading(false)
        }
      }}
    >
      <input name="phone" placeholder="2547XXXXXXXX" required className="border rounded-lg px-3 py-2" />
      <input name="amount" type="number" placeholder="Amount" required className="border rounded-lg px-3 py-2" />
      <input name="userId" placeholder="Member user id (optional)" className="border rounded-lg px-3 py-2" />
      <button
        type="submit"
        disabled={loading}
        className="bg-secondary-container rounded-lg px-4 py-2 md:col-span-3 disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Initiate STK (sandbox)'}
      </button>
      {status && <p className="text-sm text-on-surface-variant md:col-span-3">{status}</p>}
    </form>
  )
}
