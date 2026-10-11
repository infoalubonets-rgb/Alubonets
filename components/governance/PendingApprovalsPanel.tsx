'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decideResolution } from '@/app/actions/governance'
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

export default function PendingApprovalsPanel({ pending }: { pending: PendingResolution[] }) {
  const router = useRouter()

  if (!pending.length) {
    return (
      <p className="rounded-xl border bg-surface-container-low p-4 text-sm text-on-surface-variant">
        No proposals waiting for approval.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {pending.map((resolution) => (
        <PendingCard key={resolution.id} resolution={resolution} onDone={() => router.refresh()} />
      ))}
    </div>
  )
}

function PendingCard({ resolution, onDone }: { resolution: PendingResolution; onDone: () => void }) {
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([...ROLES])
  const [allowAnonymous, setAllowAnonymous] = useState(true)
  const [allowComments, setAllowComments] = useState(true)
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
    formData.set('allowComments', allowComments ? 'true' : 'false')
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
        <img src={resolution.imageUrl} alt="" className="mt-2 max-h-48 rounded-lg object-cover" />
      )}
      {resolution.documentUrl && (
        <a
          href={`/api/governance/resolutions/${resolution.id}/document`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-primary underline"
        >
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
          checked={allowComments}
          onChange={(event) => setAllowComments(event.target.checked)}
          className="mt-1"
        />
        <span>
          Allow comments
          <span className="block text-xs text-on-surface-variant">
            When off, voters only choose Approve/Oppose — the comment box is hidden.
          </span>
        </span>
      </label>

      {allowComments && (
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
      )}

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
