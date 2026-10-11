'use client'

import { useState, type FormEvent } from 'react'
import { updateMyExecutiveDetails } from '@/app/actions/profile'

export default function ExecutiveDetailsForm({ position, biography, responsibilities }: { position: string; biography: string; responsibilities: string }) {
  const [title, setTitle] = useState(position)
  const [bio, setBio] = useState(biography)
  const [duties, setDuties] = useState(responsibilities)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try { await updateMyExecutiveDetails({ position: title, biography: bio, responsibilities: duties }); setMessage('Saved.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save. Please try again.') }
    finally { setSaving(false) }
  }
  return <form onSubmit={save} className="mx-auto mt-6 max-w-3xl space-y-4 rounded-2xl border p-6">
    <h2 className="text-xl font-semibold text-primary">About Us profile</h2>
    <label className="block font-semibold">Position<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} placeholder="e.g. Chairperson" className="mt-1 block w-full rounded-lg border p-3 font-normal" /></label>
    <label className="block font-semibold">Biography<textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={5000} rows={5} className="mt-1 block w-full rounded-lg border p-3 font-normal" /></label>
    <label className="block font-semibold">Responsibilities (one per line)<textarea value={duties} onChange={event => setDuties(event.target.value)} maxLength={5000} rows={5} className="mt-1 block w-full rounded-lg border p-3 font-normal" /></label>
    {message && <p role="status" className="text-sm">{message}</p>}
    <button disabled={saving} className="rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save About page details'}</button>
  </form>
}
