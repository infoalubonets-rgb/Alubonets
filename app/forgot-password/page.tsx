'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setMessage('If that email belongs to an account, a password-reset link has been sent.')
    setLoading(false)
  }

  return <main className="min-h-screen bg-primary px-4 py-16"><form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl bg-surface p-6"><h1 className="font-h2 text-2xl text-primary">Reset your password</h1><p className="text-sm text-on-surface-variant">Enter your membership email address.</p><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border px-3 py-3" placeholder="you@example.com" />{message && <p className="rounded-lg bg-primary-fixed p-3 text-sm">{message}</p>}<button disabled={loading} className="w-full rounded-full bg-primary py-3 text-on-primary disabled:opacity-60">{loading ? 'Sending…' : 'Send reset link'}</button><Link href="/login" className="block text-center text-sm text-primary">Back to login</Link></form></main>
}
