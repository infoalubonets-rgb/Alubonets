'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { uploadRepositoryDocument } from '@/app/actions/documents'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

/** Short description for repository uploads. */
export const DOCUMENT_DESCRIPTION_MAX = 280
export const DOCUMENT_DESCRIPTION_MIN = 5

type Category = { id: string; name: string }

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

export default function AddDocumentModal({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const remaining = DOCUMENT_DESCRIPTION_MAX - description.length
  const descriptionError = validateDescription(description)

  const close = () => {
    if (pending) return
    setOpen(false)
    setError('')
    setDescription('')
  }

  const onSubmit = (formData: FormData) => {
    const descError = validateDescription(String(formData.get('description') || ''))
    if (descError) {
      setError(descError)
      return
    }
    setError('')
    startTransition(async () => {
      try {
        await uploadRepositoryDocument(formData)
        close()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not upload document')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-xs font-label-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] transition hover:opacity-90 active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[17px]">add</span>
        Add
      </button>

      <FullScreenModal open={open} title="Add document" onClose={close} size="compact">
        <form action={onSubmit} className="mx-auto grid w-full max-w-2xl gap-3 md:grid-cols-2">
          <p className="text-sm text-on-surface-variant md:col-span-2">
            Upload a PDF or Word file to the document repository.
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
            <span className="font-label-bold">Choose PDF or Word document</span>
            <span className="ml-2 text-xs text-on-surface-variant">Maximum 10 MB</span>
            <input
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              className="mt-2 block w-full text-xs"
            />
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
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || Boolean(descriptionError)}
              className="rounded-full bg-secondary-container px-5 py-2.5 text-sm font-label-bold text-on-primary disabled:opacity-50"
            >
              {pending ? 'Uploading…' : 'Upload document'}
            </button>
          </div>
        </form>
      </FullScreenModal>
    </>
  )
}
