'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createResolution, requestResolutionUploadUrl } from '@/app/actions/governance'
import { GOVERNANCE_CATEGORIES } from '@/lib/governance-categories'
import { uploadToSignedUrlWithProgress } from '@/lib/upload-client'

const DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

// Must match the bucket limits in supabase/storage.sql.
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process this image.'))), 'image/jpeg', quality)
  })
}

/** Resizes + re-encodes an image until it fits the gallery bucket's size limit. */
async function compressImage(file: File): Promise<{ file: File; originalBytes: number; finalBytes: number }> {
  const originalBytes = file.size
  const bitmap = await createImageBitmap(file)
  const maxSide = 1600
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const name = file.name.replace(/\.[^.]+$/, '.jpg')
  let best: Blob | null = null
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await toBlob(canvas, quality)
    best = blob
    if (blob.size <= IMAGE_MAX_BYTES) {
      return { file: new File([blob], name, { type: 'image/jpeg' }), originalBytes, finalBytes: blob.size }
    }
  }
  throw new Error(
    `"${file.name}" is ${formatMb(originalBytes)} and still too large after compression (limit ${formatMb(IMAGE_MAX_BYTES)}). ` +
      `Best we could get it to was ${formatMb(best!.size)} — try a smaller image.`,
  )
}

type Props = {
  onClose?: () => void
  onReopen?: () => void
}

export default function CreateResolutionForm({ onClose, onReopen }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [banner, setBanner] = useState<'ok' | 'fail' | ''>('')

  async function uploadImage(file: File): Promise<string> {
    const { file: compressed } = await compressImage(file)
    const requestFd = new FormData()
    requestFd.set('kind', 'image')
    requestFd.set('fileName', compressed.name)
    const { bucket, path, token } = await requestResolutionUploadUrl(requestFd)
    await uploadToSignedUrlWithProgress(bucket, path, token, compressed)
    return path
  }

  async function uploadDocument(file: File): Promise<{ path: string; name: string }> {
    if (file.size > DOCUMENT_MAX_BYTES) {
      throw new Error(`"${file.name}" is ${formatMb(file.size)} — documents must be ${formatMb(DOCUMENT_MAX_BYTES)} or smaller.`)
    }
    const requestFd = new FormData()
    requestFd.set('kind', 'document')
    requestFd.set('fileName', file.name)
    const { bucket, path, token } = await requestResolutionUploadUrl(requestFd)
    await uploadToSignedUrlWithProgress(bucket, path, token, file)
    return { path, name: file.name }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBanner('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const title = String(formData.get('title') || '').trim()
    const body = String(formData.get('body') || '').trim()
    const category = String(formData.get('category') || 'RESOLUTION')
    const imageFile = (formData.get('image') as File | null) ?? null
    const documentFile = (formData.get('document') as File | null) ?? null

    if (title.length < 3) return setError('Title must be at least 3 characters.')
    if (body.length < 5) return setError('Description must be at least 5 characters.')
    if (documentFile?.size && documentFile.size > DOCUMENT_MAX_BYTES) {
      return setError(`"${documentFile.name}" is ${formatMb(documentFile.size)} — documents must be ${formatMb(DOCUMENT_MAX_BYTES)} or smaller.`)
    }

    // Instant UI — close modal; upload + create continue in the browser background.
    form.reset()
    setBanner('ok')
    onClose?.()

    void (async () => {
      try {
        const [imagePath, documentResult] = await Promise.all([
          imageFile && imageFile.size > 0 ? uploadImage(imageFile) : Promise.resolve(null),
          documentFile && documentFile.size > 0 ? uploadDocument(documentFile) : Promise.resolve(null),
        ])

        const submitFd = new FormData()
        submitFd.set('title', title)
        submitFd.set('body', body)
        submitFd.set('category', category)
        if (imagePath) submitFd.set('imagePath', imagePath)
        if (documentResult) {
          submitFd.set('documentPath', documentResult.path)
          submitFd.set('documentName', documentResult.name)
        }

        await createResolution(submitFd)
        router.refresh()
      } catch (cause) {
        setBanner('fail')
        setError(cause instanceof Error ? cause.message : 'Could not submit this proposal. Try again.')
        onReopen?.()
      }
    })()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-lg text-primary">Share a proposal for approval</h2>
      <p className="text-sm text-on-surface-variant">
        Once submitted, an Admin or Super Admin must approve this before it appears on member dashboards.
        Files upload in the background so you can keep working.
      </p>
      <select name="category" defaultValue="RESOLUTION" className="block w-full rounded-lg border px-3 py-2 text-sm">
        {GOVERNANCE_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>{category.label}</option>
        ))}
      </select>
      <input
        name="title"
        required
        minLength={3}
        placeholder="Title"
        className="block w-full rounded-lg border px-3 py-2 text-sm"
      />
      <textarea
        name="body"
        required
        minLength={5}
        rows={4}
        placeholder="Describe the proposal members need to review…"
        className="block w-full rounded-lg border px-3 py-2 text-sm"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-on-surface-variant">
          Image (optional, max {formatMb(IMAGE_MAX_BYTES)})
          <input type="file" name="image" accept="image/*" className="mt-1 block w-full text-sm" />
        </label>
        <label className="text-xs font-bold text-on-surface-variant">
          Document (optional, PDF / Word / Excel, max {formatMb(DOCUMENT_MAX_BYTES)})
          <input type="file" name="document" accept={DOC_ACCEPT} className="mt-1 block w-full text-sm" />
        </label>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      {banner === 'ok' && !error && (
        <p className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
          <span className="material-symbols-outlined text-[15px]">check_circle</span>
          Submitted — uploading in the background
        </p>
      )}
      {banner === 'fail' && (
        <p className="text-sm text-error">Background submit failed. Fix the issue above and try again.</p>
      )}
      <button
        type="submit"
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
      >
        Submit for approval
      </button>
    </form>
  )
}
