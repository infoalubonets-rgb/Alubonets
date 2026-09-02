'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { voteResolution } from '@/app/actions/governance'
import { governanceCategoryLabel } from '@/lib/governance-categories'

export type GovernanceRecordDetail = {
  id: string
  title: string
  body: string
  category: string
  imageUrl: string | null
  documentUrl: string | null
  documentName: string | null
  createdByName: string
  createdAt: string
  resultsPublished: boolean
  approveCount: number
  rejectCount: number
  myVote: 'APPROVE' | 'REJECT' | null
  myComment: string | null
  myAnonymous: boolean
  responses: {
    id: string
    userId: string
    displayName: string
    vote: 'APPROVE' | 'REJECT'
    comment: string | null
    anonymous: boolean
    createdAt: string
  }[]
}

export default function GovernanceRecordDetailView({ record }: { record: GovernanceRecordDetail }) {
  const router = useRouter()
  const [vote, setVote] = useState<'APPROVE' | 'REJECT' | null>(record.myVote)
  const [comment, setComment] = useState(record.myComment || '')
  const [anonymous, setAnonymous] = useState(record.myAnonymous)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const submitVote = (choice: 'APPROVE' | 'REJECT') => {
    setError('')
    const formData = new FormData()
    formData.set('resolutionId', record.id)
    formData.set('vote', choice)
    formData.set('comment', comment)
    formData.set('anonymous', anonymous ? 'true' : 'false')
    startTransition(async () => {
      try {
        await voteResolution(formData)
        setVote(choice)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record your response')
      }
    })
  }

  return (
    <div className="space-y-5">
      <Link href="/governance" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to governance
      </Link>

      <article className="rounded-2xl border border-outline-variant bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            {governanceCategoryLabel(record.category)}
          </span>
          <p className="text-xs text-on-surface-variant">
            {new Date(record.createdAt).toLocaleString()} · {record.createdByName}
          </p>
        </div>
        <h2 className="mt-3 font-h3 text-xl text-primary">{record.title}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-on-surface">{record.body}</p>
        {record.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={record.imageUrl} alt="" className="mt-4 max-h-64 rounded-xl object-cover" />
        )}
        {record.documentUrl && (
          <a
            href={record.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            {record.documentName || 'View attachment'}
          </a>
        )}
      </article>

      <section className="rounded-2xl border border-outline-variant bg-surface p-5">
        <h3 className="font-semibold text-on-surface">Your response</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Vote to approve or oppose. Add an optional comment — choose whether your name appears.
        </p>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Optional comment for the group…"
          className="mt-3 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm"
        />
        <label className="mt-3 flex items-start gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
            className="mt-1"
          />
          <span>
            Post my comment anonymously
            <span className="mt-0.5 block text-xs text-on-surface-variant">
              Your vote is always counted; only the comment name is hidden when checked.
            </span>
          </span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => submitVote('APPROVE')}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              vote === 'APPROVE' ? 'bg-primary text-on-primary' : 'border border-primary text-primary'
            }`}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submitVote('REJECT')}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              vote === 'REJECT' ? 'bg-error text-on-error' : 'border border-error text-error'
            }`}
          >
            Oppose
          </button>
        </div>
        {vote && (
          <p className="mt-2 text-xs text-on-surface-variant">
            Your vote: {vote === 'APPROVE' ? 'Approve' : 'Oppose'}
            {anonymous && comment.trim() ? ' · Comment will show as anonymous' : ''}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
      </section>

      {(record.resultsPublished || record.responses.length > 0) && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
          <h3 className="font-semibold text-on-surface">Responses</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            <b>{record.approveCount}</b> approve · <b>{record.rejectCount}</b> oppose
          </p>
          {record.responses.length > 0 && (
            <ul className="mt-3 space-y-2">
              {record.responses.map((response) => (
                <li key={response.id} className="rounded-xl border border-outline-variant/60 bg-surface px-3 py-2.5 text-sm">
                  <p className="font-medium text-on-surface">
                    {response.displayName} · {response.vote === 'APPROVE' ? 'Approve' : 'Oppose'}
                  </p>
                  {response.comment && <p className="mt-1 text-on-surface-variant">{response.comment}</p>}
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    {new Date(response.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
