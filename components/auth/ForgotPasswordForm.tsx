"use client"

import { useState, type FormEvent } from 'react'

export default function ForgotPasswordForm({ email, onEmailChange, onBack, variant = 'modal' }: {
  email: string
  onEmailChange: (email: string) => void
  onBack: () => void
  variant?: 'modal' | 'portal'
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send reset email.')
      setMessage(data.message || 'Check your email for a reset link.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="auth-tab-content flex flex-col gap-md">
      <p className="text-sm text-on-surface-variant">Enter your email to receive a reset link.</p>
      <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
        Email address
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => { onEmailChange(event.target.value); setMessage(''); setError('') }}
          required
          disabled={loading}
          className={variant === 'modal' ? 'auth-field w-full' : 'w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface text-[14px]'}
        />
      </label>
      {message && <p role="status" className="rounded-lg bg-primary-fixed p-3 text-sm text-on-primary-fixed">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      <button type="submit" disabled={loading} className={variant === 'modal' ? 'auth-primary-btn disabled:opacity-60' : 'rounded-full bg-secondary-container py-3 font-semibold text-on-secondary disabled:opacity-60'}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <button type="button" disabled={loading} onClick={onBack} className="text-center text-sm text-primary hover:underline disabled:opacity-60">Back to sign in</button>
    </form>
  )
}
