'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { voteResolution, publishResolutionResults } from '@/app/actions/governance'
import GovernanceCommentField from '@/components/governance/GovernanceCommentField'
import VoteConfirmDialog from '@/components/governance/VoteConfirmDialog'
import { governanceCategoryLabel } from '@/lib/governance-categories'
import { validateGovernanceCommentText, governanceCommentRemaining } from '@/lib/governance-comment'

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
  allowAnonymous: boolean
  allowComments: boolean
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

export default function GovernanceRecordDetailView({
  record,
  inModal = false,
  mode = 'full',
  canPublish = false,
}: {
  record: GovernanceRecordDetail
  inModal?: boolean
  mode?: 'full' | 'respond' | 'details'
  canPublish?: boolean
}) {
  const router = useRouter()
  const [vote, setVote] = useState<'APPROVE' | 'REJECT' | null>(record.myVote)
  const [comment, setComment] = useState(record.myComment || '')
  const [anonymous, setAnonymous] = useState(record.myAnonymous)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [voteLocked, setVoteLocked] = useState(Boolean(record.myVote))
  const [confirmChoice, setConfirmChoice] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [pending, startTransition] = useTransition()
  const [publishPending, startPublish] = useTransition()
  const [publishError, setPublishError] = useState('')
  const commentAtLimit = governanceCommentRemaining(comment.length) === 0 && comment.length > 0

  const publish = () => {
    setPublishError('')
    const formData = new FormData()
    formData.set('id', record.id)
    startPublish(async () => {
      try {
        await publishResolutionResults(formData)
        router.refresh()
      } catch (e) {
        setPublishError(e instanceof Error ? e.message : 'Could not publish results')
      }
    })
  }

  const requestVote = (choice: 'APPROVE' | 'REJECT') => {
    if (voteLocked) return
    setError('')
    const commentError = validateGovernanceCommentText(comment)
    if (commentError) {
      setError(commentError)
      return
    }
    setConfirmChoice(choice)
  }

  const submitVote = (choice: 'APPROVE' | 'REJECT') => {
    setError('')
    setSuccessMessage('')
    const trimmed = comment.trim()
    const formData = new FormData()
    formData.set('resolutionId', record.id)
    formData.set('vote', choice)
    formData.set('comment', trimmed)
    formData.set('anonymous', anonymous ? 'true' : 'false')
    startTransition(async () => {
      try {
        await voteResolution(formData)
        setVote(choice)
        setVoteLocked(true)
        setConfirmChoice(null)
        setSuccessMessage(
          choice === 'APPROVE'
            ? 'Your approval has been recorded. Thank you for participating.'
            : 'Your opposition has been recorded. Thank you for participating.',
        )
        router.refresh()
      } catch (e) {
        setConfirmChoice(null)
        setError(e instanceof Error ? e.message : 'Could not record your response')
      }
    })
  }

  return (
    <div className="space-y-5">
      {!inModal && (
        <Link href="/governance" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to governance
        </Link>
      )}

      <article className={inModal ? 'space-y-3' : 'rounded-2xl border border-outline-variant bg-surface p-5 md:p-6'}>
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
          <div className="mt-4 rounded-xl border border-secondary-container/25 bg-secondary-container/10 p-4">
            <p className="text-sm font-semibold text-on-surface">
              Please read the attached document before you vote.
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Tap the button below to open the PDF in a new tab.
            </p>
            <a
              href={record.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary-container px-5 py-2.5 text-sm font-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.28)] transition hover:opacity-90 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
              {record.documentName || 'Open attached PDF'}
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          </div>
        )}
      </article>

      <section className={`relative rounded-2xl border bg-surface p-5 ${commentAtLimit ? 'border-error' : 'border-outline-variant'}`}>
          {successMessage && (
            <div
              role="status"
              className="relative z-20 mb-4 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
            >
              <span className="material-symbols-outlined shrink-0 text-[20px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}
          <div className={`relative ${voteLocked ? 'pointer-events-none select-none opacity-50 blur-[1px]' : ''}`}>
            <h3 className="font-semibold text-on-surface">Your response</h3>
            {record.allowComments && <GovernanceCommentField value={comment} onChange={setComment} />}
            {record.allowComments && record.allowAnonymous && (
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
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || voteLocked}
                onClick={() => requestVote('APPROVE')}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  vote === 'APPROVE' ? 'bg-primary text-on-primary' : 'border border-primary text-primary'
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending || voteLocked}
                onClick={() => requestVote('REJECT')}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  vote === 'REJECT' ? 'bg-error text-on-error' : 'border border-error text-error'
                }`}
              >
                Oppose
              </button>
            </div>
            {vote && !successMessage && (
              <p className="mt-2 text-xs text-on-surface-variant">
                Your vote: {vote === 'APPROVE' ? 'Approve' : 'Oppose'}
                {anonymous && comment.trim() ? ' · Comment will show as anonymous' : ''}
              </p>
            )}
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
          </div>
        </section>

      {mode !== 'respond' && (record.resultsPublished || record.responses.length > 0 || canPublish) && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
          <h3 className="font-semibold text-on-surface">Responses</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            <b>{record.approveCount}</b> approve · <b>{record.rejectCount}</b> oppose
          </p>
          {!record.resultsPublished && (
            <p className="mt-1 text-xs text-on-surface-variant">Not yet published to everyone.</p>
          )}
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
          {canPublish && !record.resultsPublished && (
            <>
              {publishError && <p className="mt-2 text-sm text-error">{publishError}</p>}
              <button
                type="button"
                disabled={publishPending}
                onClick={publish}
                className="mt-3 rounded-full bg-secondary-container px-4 py-2 text-sm text-on-primary disabled:opacity-50"
              >
                Publish results
              </button>
            </>
          )}
        </section>
      )}

      <VoteConfirmDialog
        open={Boolean(confirmChoice)}
        choice={confirmChoice}
        pending={pending}
        hasComment={Boolean(comment.trim())}
        allowComments={record.allowComments}
        onCancel={() => setConfirmChoice(null)}
        onConfirm={() => confirmChoice && submitVote(confirmChoice)}
      />
    </div>
  )
}
