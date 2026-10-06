'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import {
  requestRepositoryDocumentUploadUrl,
  uploadRepositoryDocument,
} from '@/app/actions/documents'
import { uploadToSignedUrl } from '@/lib/upload-client'
import { ROLE_LABEL } from '@/lib/auth/types'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

/** Short description for repository uploads. */
export const DOCUMENT_DESCRIPTION_MAX = 280
export const DOCUMENT_DESCRIPTION_MIN = 5

const DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

const LABEL = 'flex flex-col gap-1.5 text-sm font-semibold text-on-surface'
const FIELD = 'block w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm font-normal'

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
  const [access, setAccess] = useState('MEMBERS')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState('')
  const remaining = DOCUMENT_DESCRIPTION_MAX - description.length
  const descriptionError = validateDescription(description)

  const close = () => {
    setOpen(false)
    setError('')
    setDescription('')
    setAccess('MEMBERS')
    setFileName('')
    setFileSize('')
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
        <form onSubmit={onSubmit} className="mx-auto grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <label className={`${LABEL} sm:col-span-2`}>
            Title
            <input name="title" required minLength={2} maxLength={180} className={FIELD} />
          </label>

          <label className={LABEL}>
            Category
            <select name="categoryId" required defaultValue="" className={FIELD}>
              <option value="" disabled>Choose…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Who can see it
            <select name="accessLevel" value={access} onChange={(e) => setAccess(e.target.value)} className={FIELD}>
              <option value="MEMBERS">All members</option>
              <option value="SELECTED_ROLES">Selected roles</option>
              <option value="ADMIN_SECRETARY">Admin and Secretary</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>

          {access === 'SELECTED_ROLES' && (
            <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
              <legend className="sr-only">Roles that can see it</legend>
              {ROLES.map((role) => (
                <label key={role} className="cursor-pointer">
                  <input type="checkbox" name="allowedRoles" value={role} className="peer sr-only" />
                  <span className="inline-flex rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                    {ROLE_LABEL[role]}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-outline-variant px-3 py-3 transition hover:border-primary/50 hover:bg-primary/[0.03] sm:col-span-2">
            <span className="material-symbols-outlined text-[22px] text-primary">upload_file</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-on-surface">{fileName || 'Choose a file'}</span>
              <span className="block text-xs text-on-surface-variant">{fileSize || 'PDF, Word or Excel · up to 15 MB'}</span>
            </span>
            <input
              name="file"
              type="file"
              accept={DOC_ACCEPT}
              required
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                setFileName(file?.name ?? '')
                setFileSize(file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '')
              }}
            />
          </label>

          <label className={`${LABEL} sm:col-span-2`}>
            <span className="flex justify-between">
              <span>Description <span className="font-normal text-on-surface-variant">(optional)</span></span>
              {remaining <= 40 && <span className={`font-normal ${remaining <= 20 ? 'text-amber-700' : 'text-on-surface-variant'}`}>{remaining} left</span>}
            </span>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DOCUMENT_DESCRIPTION_MAX))}
              rows={2}
              maxLength={DOCUMENT_DESCRIPTION_MAX}
              className={`${FIELD} ${descriptionError ? 'border-error' : ''}`}
            />
            {descriptionError && <span className="text-xs font-normal text-error">{descriptionError}</span>}
          </label>

          <label className={`${LABEL} sm:col-span-2`}>
            <span>Tags <span className="font-normal text-on-surface-variant">(optional, comma-separated)</span></span>
            <input name="tags" className={FIELD} />
          </label>

          <input type="hidden" name="status" value="PUBLISHED" />
          {error && <p className="text-sm text-error sm:col-span-2">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
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
