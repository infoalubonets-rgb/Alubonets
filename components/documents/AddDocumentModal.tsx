'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import {
  requestRepositoryDocumentUploadUrl,
  uploadRepositoryDocument,
} from '@/app/actions/documents'
import { uploadToSignedUrl } from '@/lib/upload-client'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

/** Short description for repository uploads. */
export const DOCUMENT_DESCRIPTION_MAX = 280
export const DOCUMENT_DESCRIPTION_MIN = 5

const DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

type Category = { id: string; name: string }

export type OptimisticDocRow = {
  id: string
  title: string
  status: string
  categoryName: string
  uploaderName: string
  uploadedAt: string
  canView: boolean
}

function validateDescription(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length < DOCUMENT_DESCRIPTION_MIN) {
    return `Description must be at least ${DOCUMENT_DESCRIPTION_MIN} characters, or leave it empty.`
  }
  if (trimmed.length > DOCUMENT_DESCRIPTION_MAX) {
    return `Description must be ${DOCUMENT_DESCRIPTION_MAX} characters or fewer.`
  }
  return null
}

export default function AddDocumentModal({
  categories,
  onOptimisticAdd,
  onOptimisticFail,
  onOptimisticConfirm,
}: {
  categories: Category[]
  onOptimisticAdd?: (row: OptimisticDocRow) => void
  onOptimisticFail?: (tempId: string) => void
  onOptimisticConfirm?: (
    tempId: string,
    real: { id: string; title: string; status: string; categoryName: string; uploadedAt: string },
  ) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const remaining = DOCUMENT_DESCRIPTION_MAX - description.length
  const descriptionError = validateDescription(description)

  const close = () => {
    setOpen(false)
    setError('')
    setDescription('')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const descError = validateDescription(String(formData.get('description') || ''))
    if (descError) {
      setError(descError)
      return
    }
    const file = formData.get('file') as File | null
    if (!file?.size) {
      setError('Choose a document file.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Document must be 15 MB or smaller.')
      return
    }

    const title = String(formData.get('title') || '').trim()
    const categoryId = String(formData.get('categoryId') || '')
    const categoryName = categories.find((c) => c.id === categoryId)?.name || 'Documents'
    const status = String(formData.get('status') || 'PUBLISHED')
    const tempId = `temp-${Date.now()}`

    // Snapshot fields before closing/resetting.
    const submitSnapshot = new FormData()
    for (const [key, value] of formData.entries()) {
      if (key === 'file') continue
      submitSnapshot.append(key, value)
    }

    setError('')
    close()
    onOptimisticAdd?.({
      id: tempId,
      title,
      status,
      categoryName,
      uploaderName: 'You',
      uploadedAt: new Date().toISOString(),
      canView: false,
    })

    void (async () => {
      try {
        const requestFd = new FormData()
        requestFd.set('fileName', file.name)
        const { bucket, path, token, groupId } = await requestRepositoryDocumentUploadUrl(requestFd)
        await uploadToSignedUrl(bucket, path, token, file)

        submitSnapshot.set('storagePath', path)
        submitSnapshot.set('versionGroupId', groupId)
        submitSnapshot.set('mimeType', file.type || 'application/octet-stream')

        const created = await uploadRepositoryDocument(submitSnapshot)
        onOptimisticConfirm?.(tempId, created)
        router.refresh()
      } catch (e) {
        onOptimisticFail?.(tempId)
        setError(e instanceof Error ? e.message : 'Could not upload document')
        setOpen(true)
      }
    })()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-xs font-label-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] transition hover:opacity-90 active:scale-[0.98]"
      >
        Add new document
      </button>

      <FullScreenModal open={open} title="Add document" onClose={close} size="compact">
        <form onSubmit={onSubmit} className="mx-auto grid w-full max-w-2xl gap-3 md:grid-cols-2">
          <p className="text-sm text-on-surface-variant md:col-span-2">
            Upload a PDF, Word, or Excel file. The file goes straight from your browser to storage so the page stays responsive.
          </p>
          <input
            name="title"
            required
            minLength={2}
            maxLength={180}
            placeholder="Document title"
            className="rounded-xl border px-3 py-2.5 md:col-span-2"
          />
          <select name="categoryId" required className="rounded-xl border px-3 py-2.5 md:col-span-2">
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-sm text-primary md:col-span-2">
            <span className="font-label-bold">Choose PDF, Word, or Excel</span>
            <span className="ml-2 text-xs text-on-surface-variant">Maximum 15 MB</span>
            <input name="file" type="file" accept={DOC_ACCEPT} required className="mt-2 block w-full text-xs" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-on-surface md:col-span-2">
            Short description
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DOCUMENT_DESCRIPTION_MAX))}
              rows={3}
              maxLength={DOCUMENT_DESCRIPTION_MAX}
              placeholder="Optional — brief note about this document"
              className={`block w-full rounded-xl border px-3 py-2.5 font-normal ${
                descriptionError ? 'border-error' : 'border-outline-variant'
              }`}
            />
            <span className="flex justify-between text-[11px] font-semibold">
              <span className={descriptionError ? 'text-error' : 'text-on-surface-variant'}>
                {descriptionError || 'Optional. Keep it short.'}
              </span>
              <span className={remaining <= 20 ? 'text-amber-700' : 'text-on-surface-variant'}>
                {remaining} left
              </span>
            </span>
          </label>
          <select name="accessLevel" className="rounded-xl border px-3 py-2.5">
            <option value="MEMBERS">All approved members</option>
            <option value="SELECTED_ROLES">Selected roles</option>
            <option value="ADMIN_SECRETARY">Admin and Secretary only</option>
            <option value="PUBLIC">Public</option>
          </select>
          <fieldset className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-xs">
            {ROLES.map((role) => (
              <label key={role}>
                <input type="checkbox" name="allowedRoles" value={role} /> {role}
              </label>
            ))}
          </fieldset>
          <input type="hidden" name="status" value="PUBLISHED" />
          {error && <p className="text-sm text-error md:col-span-2">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/60 pt-4 md:col-span-2">
            <button type="button" onClick={close} className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(descriptionError)}
              className="rounded-full bg-secondary-container px-5 py-2.5 text-sm font-label-bold text-on-primary disabled:opacity-50"
            >
              Upload document
            </button>
          </div>
        </form>
      </FullScreenModal>
    </>
  )
}
