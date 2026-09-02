'use client'

import { useState, useTransition } from 'react'
import GovernanceCommentField from '@/components/governance/GovernanceCommentField'
import { validateGovernanceCommentText } from '@/lib/governance-comment'
import { useRouter } from 'next/navigation'
import { decideResolution, publishResolutionResults, voteResolution } from '@/app/actions/governance'
import type { Role } from '@/lib/auth/types'

const ROLES: Role[] = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER']

export type PendingResolution = {
  id: string
  title: string
  body: string
  imageUrl: string | null
  documentUrl: string | null
  documentName: string | null
  createdByName: string
  createdAt: string
}

export type ApprovedResolution = {
  id: string
  title: string
  body: string
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
  responses?: { userName: string; vote: 'APPROVE' | 'REJECT'; comment: string | null; createdAt: string }[]
}

export default function ResolutionsFeed({
  pending,
  approved,
  canApprove,
  fullDetail,
}: {
  pending: PendingResolution[]
  approved: ApprovedResolution[]
  canApprove: boolean
  fullDetail: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="space-y-5">
      {canApprove && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-h3 text-lg text-primary">Pending approval ({pending.length})</h2>
          {pending.map((r) => (
            <PendingCard key={r.id} resolution={r} onDone={refresh} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-h3 text-lg text-primary">Proposals</h2>
        {approved.length === 0 && (
          <p className="rounded-xl border bg-surface p-4 text-sm text-on-surface-variant">No proposals to show yet.</p>
        )}
        {approved.map((r) => (
          <ApprovedCard key={r.id} resolution={r} canPublish={canApprove} fullDetail={fullDetail} onDone={refresh} />
        ))}
      </section>
    </div>
  )
}

function PendingCard({ resolution, onDone }: { resolution: PendingResolution; onDone: () => void }) {
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([...ROLES])
  const [allowAnonymous, setAllowAnonymous] = useState(true)
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const toggleRole = (role: Role) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }
  const toggleAll = () => {
    setSelectedRoles((prev) => (prev.length === ROLES.length ? [] : [...ROLES]))
  }

  const approve = () => {
    setError('')
    const formData = new FormData()
    formData.set('id', resolution.id)
    formData.set('decision', 'approve')
    selectedRoles.forEach((role) => formData.append('visibleToRoles', role))
    formData.set('allowAnonymous', allowAnonymous ? 'true' : 'false')
    startTransition(async () => {
      try {
        await decideResolution(formData)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not approve this resolution')
      }
    })
  }

  const reject = () => {
    setError('')
    const formData = new FormData()
    formData.set('id', resolution.id)
    formData.set('decision', 'reject')
    formData.set('reason', reason)
    startTransition(async () => {
      try {
        await decideResolution(formData)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not reject this resolution')
      }
    })
  }

  return (
    <article className="rounded-2xl border bg-surface p-4">
      <p className="font-medium">{resolution.title}</p>
      <p className="text-xs text-on-surface-variant">
        By {resolution.createdByName} · {new Date(resolution.createdAt).toLocaleString()}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm">{resolution.body}</p>
      {resolution.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolution.imageUrl} alt="" className="mt-2 max-h-48 rounded-lg object-cover" />
      )}
      {resolution.documentUrl && (
        <a href={resolution.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">
          {resolution.documentName || 'View document'}
        </a>
      )}

      <div className="mt-3 rounded-xl bg-surface-container-low p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Show on dashboards</p>
          <button type="button" onClick={toggleAll} className="text-xs text-primary underline">
            {selectedRoles.length === ROLES.length ? 'Uncheck all' : 'Check all'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1">
              <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} /> {role}
            </label>
          ))}
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-xl bg-surface-container-low p-3 text-sm">
        <input
          type="checkbox"
          checked={allowAnonymous}
          onChange={(event) => setAllowAnonymous(event.target.checked)}
          className="mt-1"
        />
        <span>
          Allow anonymous responses
          <span className="block text-xs text-on-surface-variant">
            When enabled, a responder can hide their name from everyone, including Admin and Secretary.
          </span>
        </span>
      </label>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejecting"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button disabled={pending} onClick={reject} className="rounded-full bg-error px-4 py-2 text-sm text-on-error disabled:opacity-50">
              Confirm reject
            </button>
            <button disabled={pending} onClick={() => setRejecting(false)} className="rounded-full border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={pending} onClick={approve} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50">
            Approve
          </button>
          <button disabled={pending} onClick={() => setRejecting(true)} className="rounded-full border border-error px-4 py-2 text-sm text-error disabled:opacity-50">
            Reject
          </button>
        </div>
      )}
    </article>
  )
}

function ApprovedCard({
  resolution,
  canPublish,
  fullDetail,
  onDone,
}: {
  resolution: ApprovedResolution
  canPublish: boolean
  fullDetail: boolean
  onDone: () => void
}) {
  const [vote, setVote] = useState<'APPROVE' | 'REJECT' | null>(resolution.myVote)
  const [comment, setComment] = useState(resolution.myComment || '')
  const [anonymous, setAnonymous] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [publishPending, startPublish] = useTransition()

  const submitVote = (choice: 'APPROVE' | 'REJECT') => {
    setError('')
    const commentError = validateGovernanceCommentText(comment)
    if (commentError) {
      setError(commentError)
      return
    }
    const formData = new FormData()
    formData.set('resolutionId', resolution.id)
    formData.set('vote', choice)
    formData.set('comment', comment.trim())
    formData.set('anonymous', anonymous ? 'true' : 'false')
    startTransition(async () => {
      try {
        await voteResolution(formData)
        setVote(choice)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record your response')
      }
    })
  }

  const publish = () => {
    setError('')
    const formData = new FormData()
    formData.set('id', resolution.id)
    startPublish(async () => {
      try {
        await publishResolutionResults(formData)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not publish results')
      }
    })
  }

  const showTally = fullDetail || resolution.resultsPublished

  return (
    <article className="rounded-2xl border bg-surface p-4">
      <p className="font-medium">{resolution.title}</p>
      <p className="text-xs text-on-surface-variant">
        By {resolution.createdByName} · {new Date(resolution.createdAt).toLocaleString()}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm">{resolution.body}</p>
      {resolution.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolution.imageUrl} alt="" className="mt-2 max-h-48 rounded-lg object-cover" />
      )}
      {resolution.documentUrl && (
        <a href={resolution.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">
          {resolution.documentName || 'View document'}
        </a>
      )}

      <div className="mt-3 rounded-xl bg-surface-container-low p-3">
        <label className="text-xs font-bold uppercase text-on-surface-variant">Your comment (optional)</label>
        <GovernanceCommentField
          id={`resolution-comment-${resolution.id}`}
          value={comment}
          onChange={setComment}
          placeholder="Optional comment…"
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Post comment anonymously
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => submitVote('APPROVE')}
            className={`rounded-full px-4 py-2 text-sm disabled:opacity-50 ${vote === 'APPROVE' ? 'bg-primary text-on-primary' : 'border border-primary text-primary'}`}
          >
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => submitVote('REJECT')}
            className={`rounded-full px-4 py-2 text-sm disabled:opacity-50 ${vote === 'REJECT' ? 'bg-error text-on-error' : 'border border-error text-error'}`}
          >
            Oppose
          </button>
        </div>
        {vote && <p className="mt-2 text-xs text-on-surface-variant">Your response: {vote === 'APPROVE' ? 'Approve' : 'Oppose'}</p>}
      </div>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {showTally && (
        <div className="mt-3 rounded-xl border bg-surface-container-low p-3 text-sm">
          <p>
            <b>{resolution.approveCount}</b> approve · <b>{resolution.rejectCount}</b> oppose
          </p>
          {!resolution.resultsPublished && (
            <p className="mt-1 text-xs text-on-surface-variant">Not yet published to everyone.</p>
          )}
          {fullDetail && resolution.responses && (
            <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
              {resolution.responses.map((response, i) => (
                <li key={i}>
                  {response.userName} · {response.vote === 'APPROVE' ? 'Approve' : 'Oppose'}
                  {response.comment ? ` — ${response.comment}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canPublish && !resolution.resultsPublished && (
        <button
          disabled={publishPending}
          onClick={publish}
          className="mt-3 rounded-full bg-secondary-container px-4 py-2 text-sm text-on-primary disabled:opacity-50"
        >
          Publish results
        </button>
      )}
    </article>
  )
}
