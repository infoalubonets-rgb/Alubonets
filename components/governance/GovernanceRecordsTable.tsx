import Link from 'next/link'
import { governanceCategoryLabel } from '@/lib/governance-categories'

export type GovernanceRecordRow = {
  id: string
  title: string
  category: string
  createdAt: string
  approveCount: number
  rejectCount: number
  myVote: 'APPROVE' | 'REJECT' | null
  resultsPublished: boolean
}

export default function GovernanceRecordsTable({ records }: { records: GovernanceRecordRow[] }) {
  if (records.length === 0) {
    return (
      <p className="rounded-2xl border border-outline-variant bg-surface p-8 text-center text-sm text-on-surface-variant">
        No governance records yet.
      </p>
    )
  }

  return (
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
            <Link
              href={`/governance/${record.id}`}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary px-3.5 text-[12px] font-label-bold text-on-primary transition hover:bg-secondary-container"
            >
              View details
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
