'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal'
import AddDocumentModal, { type OptimisticDocRow } from '@/components/documents/AddDocumentModal'
import {
  deleteRepositoryDocument,
  deleteSelectedRepositoryDocuments,
  setSelectedDocumentStatus,
} from '@/app/actions/documents'

type DocRow = {
  id: string
  title: string
  status: string
  categoryName: string
  uploaderName: string
  uploadedAt: string
  isDemo?: boolean
  canView: boolean
}

export default function ManageDocumentsList({
  documents,
  categories,
  addAction,
}: {
  documents: DocRow[]
  categories?: { id: string; name: string }[]
  /** @deprecated Prefer `categories` so uploads can update the list optimistically. */
  addAction?: ReactNode
}) {
  const router = useRouter()
  const [rows, setRows] = useState(documents)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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

    // Optimistic status flip
    const previous = rows
    if (singleId) {
      setRows((current) => current.map((row) => (row.id === singleId ? { ...row, status } : row)))
    } else {
      setRows((current) => current.map((row) => (selected.has(row.id) ? { ...row, status } : row)))
    }

    startTransition(async () => {
      try {
        await setSelectedDocumentStatus(formData)
        router.refresh()
      } catch (err) {
        setRows(previous)
        setError(err instanceof Error ? err.message : 'Could not update documents.')
      }
    })
  }

  function confirmDeleteOne() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    const removed = rows.find((row) => row.id === id)
    if (!removed) return

    setError('')
    setPendingDeleteId(null)
    setRows((current) => current.filter((row) => row.id !== id))
    setSelected((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })

    const formData = new FormData()
    formData.set('id', id)
    startTransition(async () => {
      try {
        await deleteRepositoryDocument(formData)
        router.refresh()
      } catch (err) {
        setRows((current) => {
          if (current.some((row) => row.id === id)) return current
          return [removed, ...current]
        })
        setError(err instanceof Error ? err.message : 'Could not delete document.')
      }
    })
  }

  function deleteSelected() {
    if (!selected.size) return
    const ids = Array.from(selected)
    const removed = rows.filter((row) => selected.has(row.id))

    setError('')
    setConfirmBulk(false)
    setRows((current) => current.filter((row) => !selected.has(row.id)))
    setSelected(new Set())

    const formData = new FormData()
    ids.forEach((id) => formData.append('documentIds', id))
    startTransition(async () => {
      try {
        await deleteSelectedRepositoryDocuments(formData)
        router.refresh()
      } catch (err) {
        setRows((current) => {
          const missing = removed.filter((row) => !current.some((r) => r.id === row.id))
          return missing.length ? [...missing, ...current] : current
        })
        setError(err instanceof Error ? err.message : 'Could not delete documents.')
      }
    })
  }

  const addControl = categories ? (
    <AddDocumentModal
      categories={categories}
      onOptimisticAdd={(row: OptimisticDocRow) => setRows((current) => [row, ...current])}
      onOptimisticFail={(tempId) => setRows((current) => current.filter((row) => row.id !== tempId))}
      onOptimisticConfirm={(tempId, real) =>
        setRows((current) =>
          current.map((row) =>
            row.id === tempId
              ? {
                  ...row,
                  id: real.id,
                  title: real.title,
                  status: real.status,
                  categoryName: real.categoryName,
                  uploadedAt: real.uploadedAt,
                  canView: true,
                }
              : row,
          ),
        )
      }
    />
  ) : (
    addAction
  )

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-h2 text-[22px] leading-tight text-primary sm:text-[26px] md:text-[28px] dark:text-primary-fixed-dim">
          Documents
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {addControl}
          <button
            type="button"
            disabled={pending || !selected.size}
            onClick={() => setConfirmBulk(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3.5 text-xs font-label-bold text-red-700 disabled:opacity-40"
          >
            Delete selected
          </button>
          <button
            type="button"
            disabled={pending || !selected.size}
            onClick={() => runStatus('PUBLISHED')}
            className="inline-flex h-10 items-center rounded-full border border-primary/25 px-3.5 text-xs font-label-bold text-primary disabled:opacity-40"
          >
            Publish selected
          </button>
          <button
            type="button"
            disabled={pending || !selected.size}
            onClick={() => runStatus('DRAFT')}
            className="inline-flex h-10 items-center rounded-full border border-outline-variant px-3.5 text-xs font-label-bold text-on-surface-variant disabled:opacity-40"
          >
            Hide selected
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        {rows.length > 0 && (
          <label className="flex items-center gap-2 border-b border-outline-variant/60 px-4 py-2.5 text-xs font-semibold text-on-surface-variant sm:px-5">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
            Select all
          </label>
        )}

        {rows.map((document) => (
          <div
            key={document.id}
            className="flex flex-wrap items-center gap-3 border-b border-outline-variant/60 px-4 py-3 last:border-b-0 sm:px-5"
          >
            <input
              type="checkbox"
              checked={selected.has(document.id)}
              onChange={() => toggle(document.id)}
              aria-label={`Select ${document.title}`}
              className="h-4 w-4 accent-primary"
              disabled={document.id.startsWith('temp-')}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-on-surface">{document.title}</p>
              <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                {document.categoryName}
                {' · '}
                {document.uploaderName}
                {' · '}
                {new Date(document.uploadedAt).toLocaleDateString('en-KE')}
                {document.isDemo ? ' · Demo' : ''}
                {document.id.startsWith('temp-') ? ' · Uploading…' : ''}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                document.status === 'PUBLISHED'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {document.status === 'PUBLISHED' ? 'Published' : 'Hidden'}
            </span>
            {document.canView && (
              <a
                href={`/api/documents/${document.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="grid h-9 w-9 place-items-center rounded-full border border-primary/25 text-primary transition hover:bg-primary/5"
                title="Open"
                aria-label={`Open ${document.title}`}
              >
                <span className="material-symbols-outlined text-[19px]">visibility</span>
              </a>
            )}
            <button
              type="button"
              disabled={pending || document.id.startsWith('temp-')}
              onClick={() =>
                runStatus(document.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED', document.id)
              }
              className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface disabled:opacity-50"
            >
              {document.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
            </button>
            <button
              type="button"
              disabled={pending || document.id.startsWith('temp-')}
              onClick={() => setPendingDeleteId(document.id)}
              aria-label={`Delete ${document.title}`}
              title="Delete"
              className="grid h-9 w-9 place-items-center rounded-full border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[19px]">delete</span>
            </button>
          </div>
        ))}

        {!rows.length && (
          <p className="p-8 text-center text-sm text-on-surface-variant">No documents yet.</p>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(pendingDeleteId)}
        title="Delete this document?"
        description="This permanently removes the document from the repository."
        pending={false}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteOne}
      />

      <ConfirmDeleteModal
        open={confirmBulk}
        title="Delete selected documents?"
        description={
          <>
            Permanently delete <strong>{selected.size}</strong> document{selected.size === 1 ? '' : 's'}?
          </>
        }
        pending={false}
        onCancel={() => setConfirmBulk(false)}
        onConfirm={deleteSelected}
      />
    </section>
  )
}
