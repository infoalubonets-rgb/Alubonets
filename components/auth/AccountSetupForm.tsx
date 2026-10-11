'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PasswordVisibilityIcon } from '@/components/auth/AuthIcons'
import { completeAccountSetup } from '@/app/actions/account-setup'
import { loginRequest } from '@/lib/auth/client'
import { passwordError } from '@/lib/password-reset'

/** Sets the member's own password from their setup link, signs them in and opens My profile. */
export default function AccountSetupForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = passwordError(password)
    if (problem) return setError(problem)
    if (password !== confirm) return setError('The passwords do not match.')
    setError('')
    setLoading(true)
    try {
      const result = await completeAccountSetup({ token, password })
      if (!result.ok) throw new Error(result.error)
      await loginRequest(result.email, password)
      // First visit: My profile asks them to complete the details the admin left out.
      router.push('/profile?complete=1')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not finish setting up your account.')
      setLoading(false)
    }
  }

  const field = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="block text-sm font-semibold text-on-surface-variant">
      {label}
      <span className="relative mt-1 block">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          required
          className="w-full rounded-lg border border-secondary-container px-3 py-3 pr-12 text-on-surface"
        />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
          <PasswordVisibilityIcon hidden={visible} />
        </button>
      </span>
    </label>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      {field('New password', password, setPassword)}
      {field('Confirm password', confirm, setConfirm)}
      <p className="text-xs text-on-surface-variant">At least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.</p>
      {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      <button disabled={loading} className="w-full rounded-full bg-secondary-container py-3 font-semibold text-on-secondary disabled:opacity-60">
        {loading ? 'Setting up…' : 'Set password and sign in'}
      </button>
    </form>
  )
}
