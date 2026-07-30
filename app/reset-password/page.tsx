'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) return setError('Passwords do not match.')
    if (password.length < 8) return setError('Use at least 8 characters.')
    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) return setError(updateError.message)
    router.replace('/profile?password=changed')
  }

  return <main className="min-h-screen bg-primary px-4 py-16"><form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl bg-surface p-6"><h1 className="font-h2 text-2xl text-primary">Choose a new password</h1><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="w-full rounded-lg border px-3 py-3" placeholder="New password" /><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required className="w-full rounded-lg border px-3 py-3" placeholder="Confirm new password" />{error && <p className="text-sm text-error">{error}</p>}<button className="w-full rounded-full bg-primary py-3 text-on-primary">Update password</button></form></main>
}
