'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { PasswordVisibilityIcon } from '@/components/auth/AuthIcons'
import { ADMIN_LOGIN_LOGO } from '@/lib/constants'
import { passwordError } from '@/lib/password-reset'

function PasswordField({ label, value, onChange, visible, onToggle }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return <label className="block text-sm font-semibold text-on-surface-variant">{label}<span className="relative mt-1 block"><input type={visible ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} minLength={8} required className="w-full rounded-lg border border-secondary-container px-3 py-3 pr-12 text-on-surface" /><button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"><PasswordVisibilityIcon hidden={visible} /></button></span></label>
}

export default function ResetPasswordPage() {
  const token = useSearchParams().get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const policyError = passwordError(password)
    if (policyError) return setError(policyError)
    if (password !== confirm) return setError('Passwords do not match.')
    if (!token) return setError('This reset link is missing or invalid. Request a new link.')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to reset password.')
      setSuccess(data.message); setPassword(''); setConfirm('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reset password.') }
    finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-primary px-4 py-16"><div className="mx-auto max-w-md"><div className="relative z-10 mx-auto -mb-7 w-fit rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2 shadow-xl"><img src={ADMIN_LOGIN_LOGO} alt="Alubonets SHG" className="h-12 w-auto" /></div><form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface px-6 pb-6 pt-14 shadow-2xl"><div className="text-center"><h1 className="font-h2 text-2xl text-primary">Choose a new password</h1><p className="mt-2 text-sm text-on-surface-variant">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p></div>{success ? <><p role="status" className="rounded-lg bg-primary-fixed p-3 text-sm text-on-primary-fixed">{success}</p><Link href="/login" className="block w-full rounded-full bg-secondary-container py-3 text-center font-semibold text-on-secondary">Continue to login</Link></> : <><PasswordField label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} /><PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} />{error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}<button disabled={loading} className="w-full rounded-full bg-secondary-container py-3 font-semibold text-on-secondary disabled:opacity-60">{loading ? 'Updating…' : 'Update password'}</button><Link href="/forgot-password" className="block text-center text-sm text-primary hover:underline">Request another link</Link></>}</form></div></main>
}
