'use client'

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal'
import { deleteSelectedRepositoryDocuments } from '@/app/actions/documents'
import { actionDeleteMeetings } from '@/app/actions/meetings'

export type DeletableRecord = { id: string; kind: 'DOCUMENT' | 'MEETING'; title: string }
export const recordKey = (record: Pick<DeletableRecord, 'id' | 'kind'>) => `${record.kind}:${record.id}`
const Context = createContext<{
  selected: Set<string>; pending: boolean; toggle: (key: string) => void; request: (records: DeletableRecord[]) => void
} | null>(null)

export default function RecordDeletionControls({ records, children, enabled = true }: { records: DeletableRecord[]; children: ReactNode; enabled?: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmation, setConfirmation] = useState<DeletableRecord[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()
  const chosen = records.filter(record => selected.has(recordKey(record)))
  const allSelected = records.length > 0 && chosen.length === records.length
  const toggle = (key: string) => setSelected(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const request = (items: DeletableRecord[]) => { setError(''); setNotice(''); setConfirmation(items) }
  const confirm = () => {
    const items = confirmation
    startTransition(async () => {
      const completed: DeletableRecord[] = []
      try {
        const meetings = items.filter(item => item.kind === 'MEETING')
        const documents = items.filter(item => item.kind === 'DOCUMENT')
        if (meetings.length) {
          await actionDeleteMeetings(meetings.map(item => item.id))
          completed.push(...meetings)
        }
        if (documents.length) {
          const formData = new FormData()
          documents.forEach(item => formData.append('documentIds', item.id))
          await deleteSelectedRepositoryDocuments(formData)
          completed.push(...documents)
        }
        setNotice(`${items.length} record${items.length === 1 ? '' : 's'} removed. Published or linked documents are retained in the archive.`)
      } catch (cause) {
        setError(`${completed.length ? `${completed.length} records removed. ` : ''}${cause instanceof Error ? cause.message : 'Could not remove records. Please try again.'}`)
      } finally {
        setSelected(current => new Set([...current].filter(key => !completed.some(item => recordKey(item) === key))))
        setConfirmation([])
        router.refresh()
      }
    })
  }
  if (!enabled) return <>{children}</>
  return <Context.Provider value={{ selected, pending, toggle, request }}>
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface px-4 py-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" aria-label="Select all removable records on this page" checked={allSelected} disabled={pending || !records.length} onChange={() => setSelected(allSelected ? new Set() : new Set(records.map(recordKey)))} />
        Select all
      </label>
      <span className="text-xs text-on-surface-variant">{chosen.length} selected</span>
      <button type="button" disabled={pending || !chosen.length} onClick={() => request(chosen)} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-error/40 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40">
        <span className="material-symbols-outlined text-[18px]">delete</span>Delete selected
      </button>
    </div>
    {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}
    {notice && <p role="status" className="mb-3 text-sm text-on-surface-variant">{notice}</p>}
    {children}
    <ConfirmDeleteModal open={confirmation.length > 0} title={confirmation.length === 1 ? `Delete “${confirmation[0].title}”?` : `Delete ${confirmation.length} selected records?`} description="Draft meetings will be permanently deleted. Published, downloaded or linked documents will be archived; untouched document drafts will be permanently deleted." pending={pending} onCancel={() => setConfirmation([])} onConfirm={confirm} />
  </Context.Provider>
}

export function RecordSelection({ record }: { record: DeletableRecord }) {
  const context = useContext(Context)
  if (!context) return null
  const key = recordKey(record)
  return <input type="checkbox" aria-label={`Select ${record.title}`} checked={context.selected.has(key)} disabled={context.pending} onChange={() => context.toggle(key)} />
}

export function DeleteRecordButton({ record }: { record: DeletableRecord }) {
  const context = useContext(Context)
  if (!context) return null
  return <button type="button" disabled={context.pending} aria-label={`Delete ${record.title}`} onClick={() => context.request([record])} className="inline-flex items-center gap-1 rounded-full border border-error/40 px-3 py-1.5 text-xs font-semibold text-error disabled:opacity-40"><span className="material-symbols-outlined text-[17px]">delete</span>Delete</button>
}
