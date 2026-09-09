'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CONTACT_EMAIL } from '@/lib/constants'

export default function VerifyLoginPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Sending sign-in code…')
  const [deliveredTo, setDeliveredTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const sendCode = useCallback(async () => {
    setSending(true)
    setError('')
    setStatus('Sending sign-in code…')
    try {
      const res = await fetch('/api/auth/verify-login', { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeliveredTo(null)
        setStatus('')
        setError(data.error || 'Could not send code.')
        return
      }
      const inbox = typeof data.deliveredTo === 'string' ? data.deliveredTo : CONTACT_EMAIL
      setDeliveredTo(inbox)
      setStatus(
        data.redirected
          ? `Code sent to ${inbox} (test inbox for account ${data.accountEmail || 'this login'}).`
          : `Code sent to ${inbox}.`,
      )
    } catch {
      setError('Could not reach the server to send the code.')
      setStatus('')
    } finally {
      setSending(false)
    }
  }, [])

  useEffect(() => {
    void sendCode()
  }, [sendCode])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/verify-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'Invalid or expired code.')
    router.replace(data.redirectTo || '/')
  }

  return (
    <main className="min-h-screen bg-primary px-4 py-16">
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl bg-surface p-6">
        <h1 className="font-h2 text-2xl text-primary">Verify your sign-in</h1>
        <p className="text-sm text-on-surface-variant">
          Enter the six-digit code from email. Until the group sending domain is verified, live codes are
          delivered to <strong>{CONTACT_EMAIL}</strong>.
        </p>
        {status && <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">{status}</p>}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          pattern="\d{6}"
          required
          className="w-full rounded-lg border px-3 py-3 text-center text-2xl tracking-[.4em]"
        />
        {error && <p className="text-error text-sm">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-primary py-3 text-on-primary">
          Verify
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={() => void sendCode()}
          className="w-full rounded-full border border-primary py-3 text-primary disabled:opacity-60"
        >
          {sending ? 'Sending…' : deliveredTo ? 'Resend code' : 'Send code again'}
        </button>
      </form>
    </main>
  )
}
