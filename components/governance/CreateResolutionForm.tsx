'use client'

import { useState, type FormEvent } from 'react'
import { createResolution, requestResolutionUploadUrl } from '@/app/actions/governance'
import { GOVERNANCE_CATEGORIES } from '@/lib/governance-categories'
import { uploadToSignedUrl } from '@/lib/upload-client'

async function uploadIfPresent(file: File | null, kind: 'image' | 'document') {
  if (!file || file.size === 0) return null
  const requestFd = new FormData()
  requestFd.set('kind', kind)
  requestFd.set('fileName', file.name)
  const { bucket, path, token } = await requestResolutionUploadUrl(requestFd)
  await uploadToSignedUrl(bucket, path, token, file)
  return path
}

export default function CreateResolutionForm() {
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const form = event.currentTarget
      const formData = new FormData(form)
      const imageFile = (formData.get('image') as File | null) ?? null
      const documentFile = (formData.get('document') as File | null) ?? null

      const [imagePath, documentPath] = await Promise.all([
        uploadIfPresent(imageFile, 'image'),
        uploadIfPresent(documentFile, 'document'),
      ])

      const submitFd = new FormData()
      submitFd.set('title', String(formData.get('title') || ''))
      submitFd.set('body', String(formData.get('body') || ''))
      submitFd.set('category', String(formData.get('category') || 'RESOLUTION'))
      if (imagePath) submitFd.set('imagePath', imagePath)
      if (documentPath) {
        submitFd.set('documentPath', documentPath)
        submitFd.set('documentName', documentFile?.name || '')
      }

      await createResolution(submitFd)
      form.reset()
      setSuccess(true)
      window.setTimeout(() => setSuccess(false), 3000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit this proposal. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-lg text-primary">Share a proposal for approval</h2>
      <p className="text-sm text-on-surface-variant">
        Once submitted, an Admin or Super Admin must approve this before it appears on member dashboards.
      </p>
      <select name="category" defaultValue="RESOLUTION" disabled={pending} className="block w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60">
        {GOVERNANCE_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>{category.label}</option>
        ))}
      </select>
      <input
        name="title"
        required
        minLength={3}
        disabled={pending}
        placeholder="Title"
        className="block w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
      />
      <textarea
        name="body"
        required
        minLength={5}
        rows={4}
        disabled={pending}
        placeholder="Describe the proposal members need to review…"
        className="block w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-on-surface-variant">
          Image (optional)
          <input type="file" name="image" accept="image/*" disabled={pending} className="mt-1 block w-full text-sm disabled:opacity-60" />
        </label>
        <label className="text-xs font-bold text-on-surface-variant">
          Document (optional, PDF/Word)
          <input type="file" name="document" accept=".pdf,.doc,.docx" disabled={pending} className="mt-1 block w-full text-sm disabled:opacity-60" />
        </label>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:cursor-wait disabled:opacity-60"
        >
          {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
          {pending ? 'Submitting…' : 'Submit for approval'}
        </button>
        {success && !pending && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>Submitted
          </span>
        )}
      </div>
    </form>
  )
}
