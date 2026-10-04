'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import GovernanceRecordDetailView, { type GovernanceRecordDetail } from '@/components/governance/GovernanceRecordDetailView'
import { governanceCategoryLabel } from '@/lib/governance-categories'

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
}

export default function GovernanceRecordsClient({
  records,
  details,
  canPublish = false,
  showVisibility = false,
  readOnly = false,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = details.find((record) => record.id === selectedId) ?? null

  if (records.length === 0) {
    return (
      <p className="rounded-2xl border border-outline-variant bg-surface p-8 text-center text-sm text-on-surface-variant">
        No proposals yet.
      </p>
    )
  }

  return (
    <>
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
              <button
                type="button"
                onClick={() => setSelectedId(record.id)}
                title="View details"
                aria-label={`View details for ${record.title}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary transition hover:border-primary hover:bg-primary hover:text-on-primary"
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
    </>
  )
}
