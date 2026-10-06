'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import GovernanceRecordDetailView, { type GovernanceRecordDetail } from '@/components/governance/GovernanceRecordDetailView'
import { GOVERNANCE_CATEGORIES, governanceCategoryLabel } from '@/lib/governance-categories'
import { deleteResolution, updateResolution } from '@/app/actions/governance'

type GovernanceRecordRow = {
  id: string
  title: string
  category: string
  createdAt: string
  approveCount: number
  rejectCount: number
  myVote: 'APPROVE' | 'REJECT' | null
  resultsPublished: boolean
}

type Props = {
  records: GovernanceRecordRow[]
  details: GovernanceRecordDetail[]
  canPublish?: boolean
  showVisibility?: boolean
  readOnly?: boolean
  /** Edit and delete existing proposals (Admin, Super Admin, Treasurer, Secretary). */
  canManage?: boolean
}

const ICON_BUTTON =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-50'
const INPUT =
  'mt-1.5 block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

export default function GovernanceRecordsClient({
  records,
  details,
  canPublish = false,
  showVisibility = false,
  readOnly = false,
  canManage = false,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = details.find((record) => record.id === selectedId) ?? null
  const editing = details.find((record) => record.id === editId) ?? null
  const deleting = records.find((record) => record.id === deleteId) ?? null

  const openEdit = (id: string) => {
    setError('')
    setEditId(id)
  }
  const openDelete = (id: string) => {
    setError('')
    setDeleteId(id)
  }

  const submit = (action: (formData: FormData) => Promise<void>, formData: FormData, done: string) => {
    setError('')
    startTransition(async () => {
      try {
        await action(formData)
        setEditId(null)
        setDeleteId(null)
        setNotice(done)
        router.refresh()
        window.setTimeout(() => setNotice(''), 4000)
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : 'Could not save. Please try again.')
      }
    })
  }

  if (records.length === 0) {
    return (
      <p className="rounded-2xl border border-outline-variant bg-surface p-8 text-center text-sm text-on-surface-variant">
        No proposals yet.
      </p>
    )
  }

  return (
    <>
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-medium text-green-800">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {notice}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        <ul className="divide-y divide-outline-variant/60">
          {records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                {governanceCategoryLabel(record.category)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-on-surface">{record.title}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {new Date(record.createdAt).toLocaleDateString()}
                  {record.resultsPublished
                    ? ` · ${record.approveCount} approve · ${record.rejectCount} oppose`
                    : record.myVote
                      ? ` · You voted ${record.myVote === 'APPROVE' ? 'approve' : 'oppose'}`
                      : ' · Open for response'}
                </p>
              </div>
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(record.id)}
                    title="Edit proposal"
                    aria-label={`Edit ${record.title}`}
                    className={`${ICON_BUTTON} border-primary/30 bg-primary/5 text-primary hover:border-primary hover:bg-primary hover:text-on-primary`}
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDelete(record.id)}
                    title="Delete proposal"
                    aria-label={`Delete ${record.title}`}
                    className={`${ICON_BUTTON} border-error/30 bg-error/5 text-error hover:border-error hover:bg-error hover:text-white`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedId(record.id)}
                title="View details"
                aria-label={`View details for ${record.title}`}
                className={`${ICON_BUTTON} border-primary/30 bg-primary/5 text-primary hover:border-primary hover:bg-primary hover:text-on-primary`}
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <FullScreenModal
        open={Boolean(selected)}
        title={selected?.title || 'Proposal'}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <GovernanceRecordDetailView record={selected} inModal canPublish={canPublish} showVisibility={showVisibility} readOnly={readOnly} />
        )}
      </FullScreenModal>

      <FullScreenModal open={Boolean(editing)} title="Edit proposal" onClose={() => !pending && setEditId(null)} size="compact">
        {editing && (
          <form
            key={editing.id}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              formData.set('id', editing.id)
              submit(updateResolution, formData, 'Proposal updated — the change is recorded in the activity log.')
            }}
          >
            {editing.responses.length > 0 && (
              <p className="rounded-xl bg-secondary-container/15 px-3 py-2 text-[13px] text-on-surface">
                {editing.responses.length} member{editing.responses.length === 1 ? ' has' : 's have'} already responded. They responded to the old wording.
              </p>
            )}
            <label className="block text-sm font-semibold text-on-surface">
              Title
              <input name="title" required minLength={3} maxLength={200} defaultValue={editing.title} className={INPUT} />
            </label>
            <label className="block text-sm font-semibold text-on-surface">
              Category
              <select name="category" defaultValue={editing.category} className={INPUT}>
                {GOVERNANCE_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-on-surface">
              Proposal text
              <textarea name="body" required minLength={5} maxLength={6000} rows={8} defaultValue={editing.body} className={INPUT} />
            </label>
            <label className="block text-sm font-semibold text-on-surface">
              Reason for the change
              <input name="reason" required minLength={3} maxLength={500} placeholder="e.g. Corrected the budget figure" className={INPUT} />
            </label>
            {error && <p role="alert" className="rounded-xl bg-error-container/40 px-3 py-2 text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setEditId(null)} className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
                {pending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </FullScreenModal>

      <FullScreenModal open={Boolean(deleting)} title="Delete proposal" onClose={() => !pending && setDeleteId(null)} size="compact">
        {deleting && (
          <form
            key={deleting.id}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              formData.set('id', deleting.id)
              submit(deleteResolution, formData, `“${deleting.title}” was deleted — recorded in the activity log.`)
            }}
          >
            <p className="text-sm text-on-surface">
              Delete <span className="font-semibold">“{deleting.title}”</span>? Its responses and comments are removed too. This can’t be reversed, but a copy of the wording is kept in the activity log.
            </p>
            <label className="block text-sm font-semibold text-on-surface">
              Reason for deleting
              <input name="reason" required minLength={3} maxLength={500} placeholder="e.g. Duplicate of another proposal" className={INPUT} />
            </label>
            {error && <p role="alert" className="rounded-xl bg-error-container/40 px-3 py-2 text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setDeleteId(null)} className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-full bg-error px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {pending ? 'Deleting…' : 'Delete proposal'}
              </button>
            </div>
          </form>
        )}
      </FullScreenModal>
    </>
  )
}
