'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function AccountSecurity() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    const { error } = await createClient().auth.updateUser({ password })
    setMessage(error ? error.message : 'Password updated successfully.')
    if (!error) setPassword('')
  }

  async function signOutOthers() {
    const { error } = await createClient().auth.signOut({ scope: 'others' })
    setMessage(error ? error.message : 'Other sessions have been revoked.')
  }

  return <section className="rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-xl text-primary">Account security</h2><form onSubmit={changePassword} className="mt-4 flex flex-wrap gap-2"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="New password" className="min-w-0 flex-1 rounded-lg border px-3 py-2" /><button className="rounded-full bg-primary px-4 py-2 text-on-primary">Change password</button></form><button type="button" onClick={signOutOthers} className="mt-3 rounded-full border border-primary px-4 py-2 text-sm text-primary">Sign out other sessions</button>{message && <p className="mt-3 text-sm">{message}</p>}</section>
}
