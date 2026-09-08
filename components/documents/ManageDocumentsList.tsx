'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteRepositoryDocument,
  deleteSelectedRepositoryDocuments,
  setSelectedDocumentStatus,
} from '@/app/actions/documents'

type DocRow = {
  id: string
  title: string
  status: string
  version: number
  mimeType: string | null
  categoryName: string
  uploaderName: string
  downloadCount: number
}

export default function ManageDocumentsList({ documents }: { documents: DocRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(documents)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmBulk, setConfirmBulk] = useState(false)

  useEffect(() => {
    setRows(documents)
  }, [documents])

  const allSelected = rows.length > 0 && selected.size === rows.length

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(rows.map((row) => row.id)))
  }

  function runStatus(status: 'DRAFT' | 'PUBLISHED', singleId?: string) {
    setError('')
    const formData = new FormData()
    formData.set('status', status)
    if (singleId) formData.set('singleId', singleId)
    else Array.from(selected).forEach((id) => formData.append('documentIds', id))
    startTransition(async () => {
      try {
        await setSelectedDocumentStatus(formData)
        if (singleId) {
          setRows((current) => current.map((row) => (row.id === singleId ? { ...row, status } : row)))
        } else {
          setRows((current) =>
            current.map((row) => (selected.has(row.id) ? { ...row, status } : row)),
          )
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update documents.')
      }
    })
  }

  function deleteOne(id: string) {
    if (!window.confirm('Delete this document permanently? Members will no longer see it.')) return
    setError('')
    const formData = new FormData()
    formData.set('id', id)
    startTransition(async () => {
      try {
        await deleteRepositoryDocument(formData)
        setRows((current) => current.filter((row) => row.id !== id))
        setSelected((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete document.')
      }
    })
  }

  function deleteSelected() {
    if (!selected.size) return
    setError('')
    const formData = new FormData()
    Array.from(selected).forEach((id) => formData.append('documentIds', id))
    startTransition(async () => {
      try {
        await deleteSelectedRepositoryDocuments(formData)
        setRows((current) => current.filter((row) => !selected.has(row.id)))
        setSelected(new Set())
        setConfirmBulk(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete documents.')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-h3 text-xl text-primary">Your documents</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !selected.size}
            onClick={() => runStatus('DRAFT')}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-label-bold text-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">visibility_off</span> Hide selected
          </button>
          <button
            type="button"
            disabled={pending || !selected.size}
            onClick={() => runStatus('PUBLISHED')}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-label-bold text-on-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">publish</span> Publish selected
          </button>
          <button
            type="button"
            disabled={pending || !selected.size}
            onClick={() => setConfirmBulk(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-label-bold text-red-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">delete</span> Delete selected
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rows.length > 0 && (
        <label className="flex items-center gap-2 px-1 text-xs font-semibold text-on-surface-variant">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
          Select all
        </label>
      )}

      {rows.map((document) => (
        <article
          key={document.id}
          className="flex items-start gap-3 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-[0_4px_16px_rgba(0,31,80,0.05)]"
        >
          <input
            type="checkbox"
            checked={selected.has(document.id)}
            onChange={() => toggle(document.id)}
            aria-label={`Select ${document.title}`}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
            <span className="material-symbols-outlined">
              {document.mimeType?.includes('pdf') ? 'picture_as_pdf' : 'description'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-label-bold text-primary">{document.title}</h3>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {document.categoryName} · v{document.version}.0 · {document.downloadCount} downloads ·{' '}
                  {document.uploaderName}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-label-bold uppercase tracking-wider ${
                  document.status === 'PUBLISHED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-secondary-container/10 text-secondary'
                }`}
              >
                {document.status === 'PUBLISHED' ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/api/documents/${document.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span> View
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => runStatus(document.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED', document.id)}
                className="inline-flex items-center gap-1 rounded-full bg-secondary-container/10 px-3 py-1.5 text-xs font-label-bold text-secondary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {document.status === 'PUBLISHED' ? 'visibility_off' : 'publish'}
                </span>
                {document.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => deleteOne(document.id)}
                className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-label-bold text-red-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span> Delete
              </button>
            </div>
          </div>
        </article>
      ))}

      {!rows.length && (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-on-surface-variant">
          No documents added yet.
        </p>
      )}

      {confirmBulk && (
        <div
          className="fixed inset-0 z-[140] grid place-items-center bg-[#001f50]/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setConfirmBulk(false)
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
            <h3 className="font-h3 text-xl text-on-surface">Delete selected documents?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Permanently delete <strong>{selected.size}</strong> document{selected.size === 1 ? '' : 's'}? Members
              will no longer be able to open them.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmBulk(false)}
                className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={deleteSelected}
                className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
