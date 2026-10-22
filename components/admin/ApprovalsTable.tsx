'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { setMemberApproval, updatePendingApplicant } from '@/app/actions/members'
import type { Role } from '@/lib/auth/types'
import { memberEditFields, type MemberEditValues } from '@/lib/member-edit-fields'

export type ApprovalApplicant = {
  id: string
  fullName: string
  email: string
  phone: string | null
  createdAt: string
  consentSummary: string | null
  hasPrincipalLink: boolean
  fields: [string, string | null | undefined][]
  editable: MemberEditValues
}

type PrincipalOption = { id: string; fullName: string; membershipNumber: string | null }
type RoleOption = { value: Role; label: string }

export default function ApprovalsTable({
  applicants,
  principals,
  roleOptions,
}: {
  applicants: ApprovalApplicant[]
  principals: PrincipalOption[]
  roleOptions: RoleOption[]
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState<MemberEditValues | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmingReject, setConfirmingReject] = useState(false)
  const [linkingPrincipal, setLinkingPrincipal] = useState(false)
  const [principalId, setPrincipalId] = useState('')
  const [relationship, setRelationship] = useState<'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER'>('OTHER')
  const defaultRole = roleOptions.find((option) => option.value === 'MEMBER')?.value ?? roleOptions[0]?.value ?? 'MEMBER'
  const [role, setRole] = useState<Role>(defaultRole)
  const roleLabel = roleOptions.find((option) => option.value === role)?.label ?? 'Member'
  const canApprove = roleOptions.some((option) => option.value === role)
  const [error, setError] = useState('')
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  useEffect(() => setMounted(true), [])

  const selected = useMemo(
    () => applicants.find((a) => a.id === selectedId) ?? null,
    [applicants, selectedId],
  )
  const visibleApplicants = useMemo(
    () => applicants.filter((applicant) => !removedIds.has(applicant.id)),
    [applicants, removedIds],
  )

  const open = (id: string) => {
    setSelectedId(id)
    setEditing(false)
    setSaved(false)
    setEditValues(applicants.find((applicant) => applicant.id === id)?.editable ?? null)
    setConfirmingReject(false)
    setLinkingPrincipal(false)
    setPrincipalId('')
    setRole(defaultRole)
    setError('')
  }

  const close = () => {
    setSelectedId(null)
    setEditing(false)
    setConfirmingReject(false)
    setLinkingPrincipal(false)
    setPrincipalId('')
    setError('')
  }

  const saveEdits = () => {
    if (!selected || !editValues) return
    setError('')
    setSaved(false)
    startTransition(async () => {
      try {
        await updatePendingApplicant({ userId: selected.id, ...editValues })
        setEditing(false)
        setSaved(true)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save applicant details')
      }
    })
  }

  const decide = (approve: boolean, link?: { principalMemberId: string; familyRelationship: typeof relationship }) => {
    if (!selected) return
    const applicant = selected
    setError('')
    if (!approve) {
      setRemovedIds((current) => new Set(current).add(applicant.id))
      close()
    }
    startTransition(async () => {
      try {
        await setMemberApproval({
          userId: applicant.id,
          approve,
          note: approve ? 'Approved via admin approvals' : 'Rejected via admin approvals',
          identityVerified: true,
          role,
          ...link,
        })
        if (approve) close()
        router.refresh()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not record decision'
        if (!approve) {
          setRemovedIds((current) => {
            const restored = new Set(current)
            restored.delete(applicant.id)
            return restored
          })
          setSelectedId(applicant.id)
          setConfirmingReject(false)
        }
        setError(message)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        {/* Phones: one card per applicant. */}
        <ul className="divide-y divide-outline-variant/50 md:hidden">
          {visibleApplicants.length === 0 ? (
            <li className="py-10 text-center text-sm text-on-surface-variant">No pending applicants</li>
          ) : (
            visibleApplicants.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-on-surface">{a.fullName}</p>
                  <p className="truncate text-xs text-on-surface-variant">{a.email}</p>
                  <p className="text-xs text-on-surface-variant">
                    {a.phone ? `${a.phone} · ` : ''}Registered {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => open(a.id)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant text-primary"
                  aria-label={`View ${a.fullName}`}
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left bg-surface-container-low border-b border-outline-variant">
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Applicant
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Contact
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Registered
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant text-right w-16">
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleApplicants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-on-surface-variant">
                    No pending applicants
                  </td>
                </tr>
              ) : (
                visibleApplicants.map((a, i) => (
                  <tr
                    key={a.id}
                    className={`border-t border-outline-variant/50 hover:bg-primary/[0.03] transition-colors ${
                      i % 2 === 1 ? 'bg-surface-container-low/40' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-on-surface">{a.fullName}</p>
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      <p>{a.email}</p>
                      {a.phone && <p className="text-xs">{a.phone}</p>}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => open(a.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-primary hover:border-secondary-container hover:bg-secondary-container/10 hover:text-secondary transition-colors"
                        title="View application"
                        aria-label={`View ${a.fullName}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mounted &&
        selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute inset-0 bg-primary/55 backdrop-blur-sm"
              aria-label="Close"
              onClick={close}
            />
            <div className="relative w-full max-w-lg rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)] overflow-hidden max-h-[min(90vh,680px)] flex flex-col">
              <div className="relative bg-primary px-5 py-4 shrink-0">
                <div className="absolute bottom-0 inset-x-0 h-1 bg-secondary-container" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-h3 text-[18px] text-on-primary truncate">{selected.fullName}</h3>
                    <p className="text-[12px] text-primary-fixed-dim mt-0.5 truncate">
                      {selected.email}
                      {selected.phone ? ` · ${selected.phone}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-primary shrink-0"
                  >
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-5 space-y-5">
                <p className="text-xs text-on-surface-variant">
                  Registered {new Date(selected.createdAt).toLocaleString()} · Consent:{' '}
                  {selected.consentSummary || 'No consent record'}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={pending} onClick={() => { setEditing(!editing); setError(''); setSaved(false); setEditValues(selected.editable) }}
                    className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-primary">
                    {editing ? 'Cancel editing' : 'Edit details'}
                  </button>
                  {saved && <span className="text-sm text-primary">Details saved</span>}
                </div>

                {error && <p className="rounded-xl bg-error-container/40 px-3 py-2 text-sm text-error">{error}</p>}

                {editing && editValues ? (
                  <div className="space-y-3">
                    <p className="text-xs text-on-surface-variant">Email is the login identifier and cannot be changed here.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {memberEditFields.map(({ key, label, options }) => (
                        <label key={key} className="block text-xs font-semibold text-on-surface-variant">{label}
                          {options ? <select value={editValues[key] ?? ''} onChange={(event) => setEditValues({ ...editValues, [key]: event.target.value || null })}
                            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-normal text-on-surface">
                            <option value="">Not provided</option>
                            {options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                          </select> : <input type={key === 'dateOfBirth' ? 'date' : 'text'} value={editValues[key] ?? ''}
                            onChange={(event) => setEditValues({ ...editValues, [key]: event.target.value || (key === 'dateOfBirth' ? null : '') })}
                            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-normal text-on-surface" />}
                        </label>
                      ))}
                    </div>
                    <button type="button" disabled={pending} onClick={saveEdits} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{pending ? 'Saving…' : 'Save details'}</button>
                  </div>
                ) : <>

                {selected.fields.length > 0 && (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {selected.fields.map(([title, value]) => (
                      <div key={title} className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5">
                        <dt className="text-[10px] uppercase tracking-wide font-label-bold text-on-surface-variant">
                          {title}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium text-on-surface whitespace-pre-wrap">
                          {value || '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                </>}

                {!editing && <section className="pt-1 border-t border-outline-variant space-y-3">
                  {error && (
                    <p className="text-sm text-error text-center bg-error-container/40 rounded-xl py-2 px-3">
                      {error}
                    </p>
                  )}

                  {!confirmingReject && (
                    <label className="block text-xs font-bold text-on-surface-variant">
                      Approve as
                      <select
                        value={role}
                        onChange={(event) => setRole(event.target.value as Role)}
                        disabled={pending}
                        className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm font-normal text-on-surface"
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <span className="mt-1 block font-normal">Choose the role this account will receive when approved.</span>
                    </label>
                  )}

                  {confirmingReject ? (
                    <div className="rounded-xl border border-error/40 bg-error-container/30 p-3 space-y-2">
                      <p className="text-sm text-error font-medium">
                        Reject this application and remove its login access? A minimal record is retained for audit and family history.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => decide(false)}
                          className="rounded-lg bg-error px-4 py-2 text-sm text-on-error disabled:opacity-50"
                        >
                          {pending ? 'Rejecting…' : 'Yes, reject application'}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmingReject(false)}
                          className="rounded-lg border border-outline-variant px-4 py-2 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : linkingPrincipal ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
                      <div><h4 className="text-sm font-bold text-primary">Link to a Principal Member</h4><p className="mt-1 text-xs text-on-surface-variant">This applicant registered directly and is not attached to a family branch.</p></div>
                      <label className="block text-xs font-bold text-on-surface-variant">Principal Member
                        <select value={principalId} onChange={(event) => setPrincipalId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm font-normal text-on-surface">
                          <option value="">Select Principal Member</option>
                          {principals.map((principal) => <option key={principal.id} value={principal.id}>{principal.fullName}{principal.membershipNumber ? ` · ${principal.membershipNumber}` : ''}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs font-bold text-on-surface-variant">Relationship
                        <select value={relationship} onChange={(event) => setRelationship(event.target.value as typeof relationship)} className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm font-normal text-on-surface">
                          <option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="DEPENDENT">Dependent</option><option value="OTHER">Other</option>
                        </select>
                      </label>
                      {principals.length === 0 && <p className="text-xs font-semibold text-error">No active Principal Members are available. Create or activate one before approving this account.</p>}
                      <div className="flex gap-2 pt-1">
                        <button type="button" disabled={pending || !principalId || !canApprove} onClick={() => decide(true, { principalMemberId: principalId, familyRelationship: relationship })} className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40">{pending ? 'Approving…' : `Link and approve as ${roleLabel}`}</button>
                        <button type="button" disabled={pending} onClick={() => setLinkingPrincipal(false)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm">Back</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending || !canApprove}
                        onClick={() => selected.hasPrincipalLink ? decide(true) : setLinkingPrincipal(true)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50"
                      >
                        {pending ? 'Approving…' : `Approve as ${roleLabel}`}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmingReject(true)}
                        className="rounded-lg border border-error px-4 py-2 text-sm text-error disabled:opacity-50"
                      >
                        Reject and delete
                      </button>
                    </div>
                  )}
                </section>}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
