'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { voteResolution, publishResolutionResults, updateResolutionVisibility } from '@/app/actions/governance'
import GovernanceCommentField from '@/components/governance/GovernanceCommentField'
import VoteConfirmDialog from '@/components/governance/VoteConfirmDialog'
import VoteSuccessDialog from '@/components/governance/VoteSuccessDialog'
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
  visibleToRoles: string[]
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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  EXECUTIVE: 'Executive',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  ORGANIZER: 'Organizing Secretary',
  MEMBER: 'Member',
}
const VISIBILITY_ROLES = ['MEMBER', 'ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER']

export default function GovernanceRecordDetailView({
  record,
  inModal = false,
  mode = 'full',
  canPublish = false,
  showVisibility = false,
  readOnly = false,
}: {
  record: GovernanceRecordDetail
  inModal?: boolean
  mode?: 'full' | 'respond' | 'details'
  canPublish?: boolean
  /** Show the audience/visibility settings this proposal was approved with (Admin/Secretary only). */
  showVisibility?: boolean
  /** Oversight viewers (Auditor) see the record and responses but cannot vote. */
  readOnly?: boolean
}) {
  const router = useRouter()
  const [vote, setVote] = useState<'APPROVE' | 'REJECT' | null>(record.myVote)
  const [comment, setComment] = useState(record.myComment || '')
  const [anonymous, setAnonymous] = useState(record.myAnonymous)
  const [error, setError] = useState('')
  const [voteLocked, setVoteLocked] = useState(Boolean(record.myVote))
  const [confirmChoice, setConfirmChoice] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [successChoice, setSuccessChoice] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [pending, setPending] = useState(false)
  const [publishPending, setPublishPending] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [visibleRoles, setVisibleRoles] = useState<string[]>(record.visibleToRoles)
  const [visComments, setVisComments] = useState(record.allowComments)
  const [visAnonymous, setVisAnonymous] = useState(record.allowAnonymous)
  const [visPending, setVisPending] = useState(false)
  const [visSaved, setVisSaved] = useState(false)
  const [visError, setVisError] = useState('')
  const commentAtLimit = governanceCommentRemaining(comment.length) === 0 && comment.length > 0

  const toggleVisibleRole = (role: string) => {
    setVisibleRoles((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]))
  }

  const saveVisibility = async () => {
    setVisError('')
    if (visibleRoles.length === 0) {
      setVisError('Select at least one dashboard to show this on.')
      return
    }
    setVisPending(true)
    const formData = new FormData()
    formData.set('id', record.id)
    visibleRoles.forEach((role) => formData.append('visibleToRoles', role))
    formData.set('allowComments', visComments ? 'true' : 'false')
    formData.set('allowAnonymous', visAnonymous ? 'true' : 'false')
    try {
      await updateResolutionVisibility(formData)
      setVisSaved(true)
      router.refresh()
      window.setTimeout(() => setVisSaved(false), 2000)
    } catch (e) {
      setVisError(e instanceof Error ? e.message : 'Could not save visibility settings.')
    } finally {
      setVisPending(false)
    }
  }

  const publish = async () => {
    setPublishError('')
    setPublishPending(true)
    const formData = new FormData()
    formData.set('id', record.id)
    try {
      await publishResolutionResults(formData)
      router.refresh()
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Could not publish results')
    } finally {
      setPublishPending(false)
    }
  }

  const requestVote = (choice: 'APPROVE' | 'REJECT') => {
    if (voteLocked || pending) return
    setError('')
    const commentError = validateGovernanceCommentText(comment)
    if (commentError) {
      setError(commentError)
      return
    }
    setConfirmChoice(choice)
  }

  const submitVote = async (choice: 'APPROVE' | 'REJECT') => {
    setError('')
    setPending(true)
    // Close confirm immediately so the UI does not stick on “Submitting…”
    setConfirmChoice(null)

    const trimmed = comment.trim()
    const formData = new FormData()
    formData.set('resolutionId', record.id)
    formData.set('vote', choice)
    formData.set('comment', trimmed)
    formData.set('anonymous', anonymous ? 'true' : 'false')

    try {
      await voteResolution(formData)
      setVote(choice)
      setVoteLocked(true)
      setSuccessChoice(choice)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your response')
    } finally {
      setPending(false)
    }
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
          <img src={record.imageUrl} alt="" className="mt-4 max-h-64 rounded-xl object-cover" />
        )}
        {record.documentUrl && (
          <div className="mt-4 rounded-xl border border-secondary-container/25 bg-secondary-container/10 p-4">
            <p className="text-sm font-semibold text-on-surface">
              Please read the attached document before you vote.
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Tap the button below to open the attachment in a new tab.
            </p>
            <a
              href={`/api/governance/resolutions/${record.id}/document`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary-container px-5 py-2.5 text-sm font-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.28)] transition hover:opacity-90 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">description</span>
              {record.documentName || 'Open attached document'}
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          </div>
        )}
      </article>

      {showVisibility && canPublish && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Visibility</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Choose which dashboards can see this proposal.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {VISIBILITY_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1.5 text-xs font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={visibleRoles.includes(role)}
                  onChange={() => toggleVisibleRole(role)}
                  className="h-4 w-4 accent-primary"
                />
                {ROLE_LABEL[role] || role}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-on-surface">
              <input type="checkbox" checked={visComments} onChange={(e) => setVisComments(e.target.checked)} className="h-4 w-4 accent-primary" />
              Allow comments
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-on-surface">
              <input type="checkbox" checked={visAnonymous} onChange={(e) => setVisAnonymous(e.target.checked)} className="h-4 w-4 accent-primary" />
              Allow anonymous responses
            </label>
          </div>
          {visError && <p className="mt-2 text-xs text-error">{visError}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={visPending}
              onClick={saveVisibility}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary disabled:cursor-wait disabled:opacity-60"
            >
              {visPending && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
              {visPending ? 'Saving…' : 'Save visibility'}
            </button>
            {visSaved && !visPending && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>Saved
              </span>
            )}
          </div>
          <p className="mt-3 border-t border-outline-variant/60 pt-2 text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">Managed by:</span> Admin (including Super Admin) can
            approve, reject, and publish results · Secretary can view and track.
          </p>
        </section>
      )}

      {showVisibility && !canPublish && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Visibility</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {record.visibleToRoles.length > 0 ? (
              record.visibleToRoles.map((role) => (
                <span key={role} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {ROLE_LABEL[role] || role}
                </span>
              ))
            ) : (
              <span className="text-xs text-on-surface-variant">No roles selected — hidden from member dashboards.</span>
            )}
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {record.allowComments ? 'Comments allowed' : 'Comments hidden'} ·{' '}
            {record.allowAnonymous ? 'Anonymous responses allowed' : 'Anonymous responses hidden'}
          </p>
          <p className="mt-3 border-t border-outline-variant/60 pt-2 text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">Managed by:</span> Admin (including Super Admin) can
            approve, reject, and publish results · Secretary can view and track.
          </p>
        </section>
      )}

      {!readOnly && (
      <section
        className={`rounded-2xl border bg-surface p-5 ${
          commentAtLimit && !voteLocked ? 'border-error' : 'border-outline-variant'
        }`}
      >
        <h3 className="font-semibold text-on-surface">Your response</h3>

        {voteLocked && vote ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  vote === 'APPROVE' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                }`}
              >
                {vote === 'APPROVE' ? 'Approved' : 'Opposed'}
              </span>
              <span className="text-xs text-on-surface-variant">Final — cannot be edited</span>
            </div>
            {record.allowComments && (
              <div className="rounded-xl border border-outline-variant/70 bg-surface-container-low px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Your comment
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">
                  {comment.trim() ? comment : 'No comment added.'}
                </p>
                {anonymous && comment.trim() ? (
                  <p className="mt-2 text-xs text-on-surface-variant">Posted anonymously</p>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <>
            {pending && (
              <p className="mt-2 text-sm text-on-surface-variant" role="status">
                Recording your vote…
              </p>
            )}
            {record.allowComments && (
              <GovernanceCommentField value={comment} onChange={setComment} disabled={pending} />
            )}
            {record.allowComments && record.allowAnonymous && (
              <label className="mt-3 flex items-start gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={anonymous}
                  disabled={pending}
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
                disabled={pending}
                onClick={() => requestVote('APPROVE')}
                className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => requestVote('REJECT')}
                className="rounded-full border border-error px-4 py-2 text-sm font-semibold text-error disabled:opacity-50"
              >
                Oppose
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
          </>
        )}
      </section>
      )}

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
        pending={false}
        hasComment={Boolean(comment.trim())}
        allowComments={record.allowComments}
        onCancel={() => setConfirmChoice(null)}
        onConfirm={() => confirmChoice && void submitVote(confirmChoice)}
      />

      <VoteSuccessDialog
        open={Boolean(successChoice)}
        choice={successChoice}
        onClose={() => setSuccessChoice(null)}
      />
    </div>
  )
}
