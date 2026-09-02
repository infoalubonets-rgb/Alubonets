'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ADMIN_LOGIN_LOGO } from '@/lib/constants'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send reset email.')
      setMessage(data.message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send reset email.')
    } finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-primary px-4 py-16"><div className="mx-auto max-w-md"><div className="relative z-10 mx-auto -mb-7 w-fit rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2 shadow-xl"><img src={ADMIN_LOGIN_LOGO} alt="Alubonets SHG" className="h-12 w-auto" /></div><form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface px-6 pb-6 pt-14 shadow-2xl"><div className="text-center"><h1 className="font-h2 text-2xl text-primary">Forgot your password?</h1><p className="mt-2 text-sm text-on-surface-variant">Enter the email attached to your account. You may request one reset every 24 hours.</p></div><label className="block text-sm font-semibold text-on-surface-variant">Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-secondary-container px-3 py-3 text-on-surface" placeholder="you@example.com" /></label>{message && <p role="status" className="rounded-lg bg-primary-fixed p-3 text-sm text-on-primary-fixed">{message}</p>}{error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}<button disabled={loading || Boolean(message)} className="w-full rounded-full bg-secondary-container py-3 font-semibold text-on-secondary disabled:opacity-60">{loading ? 'Sending…' : 'Send reset link'}</button><Link href="/login" className="block text-center text-sm text-primary hover:underline">Back to login</Link></form></div></main>
}
