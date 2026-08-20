'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ErrorDialog from '@/components/ui/ErrorDialog'
import { friendlyError } from '@/lib/safe-error'
import {
  createAttachedMember,
  linkExistingFamilyMember,
  revokeFamilyInvite,
  inviteRecordOnlyAdult,
} from '@/app/actions/family'

const RELATIONSHIPS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'CHILD', label: 'Child' },
  { value: 'DEPENDENT', label: 'Dependent' },
  { value: 'OTHER', label: 'Other' },
] as const

type Relationship = (typeof RELATIONSHIPS)[number]['value']
type Mode = 'LINK_EXISTING' | 'INVITE_NEW' | 'RECORD_ONLY'

type InviteRow = {
  id: string
  email: string
  expiresAt: string
  acceptedAt: string | null
}

type BranchMember = {
  id: string
  fullName: string
  email: string
  relationship: string | null
  status: string
  registrationState: string
  isYou?: boolean
  adultInviteEligible?: boolean
  phone?: string | null
  lineage?: string | null
}

export default function FamilyBranchClient({
  isPrincipal,
  defaultLineage,
  principalName,
  relationshipLabel,
  members,
  pendingInvites,
  adulthoodAge,
  transitionHistory,
}: {
  isPrincipal: boolean
  defaultLineage: string
  principalName: string | null
  relationshipLabel: string | null
  members: BranchMember[]
  pendingInvites: InviteRow[]
  adulthoodAge: number
  transitionHistory: Array<{ id: string; type: string; reason: string; fromState: string; toState: string; occurredAt: string; memberName: string }>
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('LINK_EXISTING')
  const [relationship, setRelationship] = useState<Relationship>('SPOUSE')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [lineage, setLineage] = useState(defaultLineage)
  const [detailMember, setDetailMember] = useState<BranchMember | null>(null)
  const [error, setError] = useState('')
  const friendly = error ? friendlyError(error, 'We could not update the family branch. Please try again.') : null
  const [ok, setOk] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [pending, startTransition] = useTransition()
  const modalScrollRef = useRef<HTMLElement>(null)
  const [modalScrollbar, setModalScrollbar] = useState({ visible: false, top: 0, height: 0 })

  useEffect(() => {
    if (!modalOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) setModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalOpen, pending])

  useEffect(() => {
    if (!modalOpen) return
    const element = modalScrollRef.current
    if (!element) return
    const update = () => {
      const visible = element.scrollHeight > element.clientHeight + 1
      const height = visible ? Math.max(24, (element.clientHeight / element.scrollHeight) * element.clientHeight) : 0
      const travel = Math.max(0, element.clientHeight - height)
      const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight)
      setModalScrollbar({ visible, height, top: (element.scrollTop / maxScroll) * travel })
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => { element.removeEventListener('scroll', update); observer.disconnect() }
  }, [modalOpen, mode, pendingInvites.length, ok, error, inviteUrl])

  const clearForm = () => {
    setFullName('')
    setEmail('')
    setPhone('')
    setDateOfBirth('')
    setLineage(defaultLineage)
  }

  const submit = () => {
    setError('')
    setOk('')
    setInviteUrl('')
    startTransition(async () => {
      try {
        if (mode === 'LINK_EXISTING') {
          await linkExistingFamilyMember({ email, relationship })
          setOk('Member linked to your family branch.')
        } else {
          const result = await createAttachedMember({
            mode: mode === 'INVITE_NEW' ? 'INVITE_NEW' : 'RECORD_ONLY',
            fullName,
            relationship,
            email,
            phone,
            dateOfBirth,
            lineage,
          })
          if (result.mode === 'INVITE_NEW') {
            setOk(
              result.emailSkipped
                ? 'Email delivery failed. Copy the invitation link below.'
                : result.testMode
                  ? `Test mode: Resend accepted the invitation for ${result.deliveredTo}. Check Inbox, Spam and Promotions. The registration link is also shown below.`
                  : `Resend accepted the invitation for ${result.deliveredTo || email}. The account will still require admin approval.`,
            )
            if (result.inviteUrl) setInviteUrl(result.inviteUrl)
          } else {
            setOk('Family member added without a login.')
          }
        }
        clearForm()
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update the family branch')
      }
    })
  }

  const principal = members.find((member) => member.relationship === 'Principal' || (member.isYou && isPrincipal))
  const attached = members.filter((member) => member.id !== principal?.id)

  return (
    <div className="w-full space-y-3">
      <div className="flex min-h-10 items-center justify-between gap-4">
        <h1 className="font-h2 text-[28px] leading-tight text-primary dark:text-primary-fixed-dim">My Family / Branch</h1>
        {isPrincipal && (
          <button
            type="button"
            onClick={() => {
              setError('')
              setOk('')
              setModalOpen(true)
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary-container px-3 text-xs font-semibold text-on-primary shadow-sm transition hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Add family member
          </button>
        )}
      </div>
      <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface shadow-[0_8px_24px_rgba(0,31,80,0.06)] dark:border-[#1a2d4f] dark:bg-[#0d1729]">
        <div className="p-4">
          {principal && (
            <div className="flex items-center gap-3 rounded-xl bg-primary/[0.045] p-3 dark:bg-white/[0.04]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                {principal.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-on-surface dark:text-blue-50">
                    {principal.fullName}{principal.isYou ? ' (you)' : ''}
                  </p>
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-primary">
                    Principal Member
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="ml-5 border-l border-outline-variant/70 pl-5 dark:border-[#1e3461]">
            {attached.map((member) => (
              <div key={member.id} className="relative flex items-center gap-3 border-b border-outline-variant/40 py-3 last:border-0 dark:border-[#1a2d4f]">
                <span className="absolute -left-5 top-1/2 h-px w-4 bg-outline-variant dark:bg-[#1e3461]" />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-primary dark:bg-[#111f36] dark:text-blue-200">
                  {member.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-on-surface dark:text-blue-50">
                    {member.fullName}{member.isYou ? ' (you)' : ''}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant dark:text-blue-200/55">{member.email}</p>
                  <p className="text-xs text-on-surface-variant dark:text-blue-200/55">
                    {member.phone || 'No phone'} · Lineage: {member.lineage || 'Not provided'}
                  </p>
                </div>
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant dark:bg-[#111f36] dark:text-blue-200">
                  {member.relationship || 'Family member'}
                </span>
                <button type="button" onClick={() => setDetailMember(member)} aria-label={`View details for ${member.fullName}`} title="View member details" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant text-primary transition hover:bg-primary/5">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                </button>
                {isPrincipal && member.registrationState === 'RECORD_ONLY' && (
                  <button type="button" disabled={!member.adultInviteEligible || pending}
                    title={member.adultInviteEligible ? 'Invite this adult to activate a login' : `Available at age ${adulthoodAge}`}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold disabled:opacity-40"
                    onClick={() => {
                      const address = window.prompt('Email address for the login invitation')
                      if (!address) return
                      startTransition(async () => {
                        try {
                          const result = await inviteRecordOnlyAdult({ memberId: member.id, email: address })
                          setOk('Adult login invitation sent.')
                          if (result.inviteUrl) setInviteUrl(result.inviteUrl)
                          router.refresh()
                        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not invite member') }
                      })
                    }}>Activate login</button>
                )}
              </div>
            ))}
            {attached.length === 0 && (
              <div className="py-5 text-sm text-on-surface-variant">
                No attached family members yet.
              </div>
            )}
          </div>
          {!principal && (
            <p className="p-3 text-sm text-on-surface-variant">
              {principalName
                ? `Principal Member: ${principalName}${relationshipLabel ? ` · ${relationshipLabel}` : ''}`
                : 'No Principal Member has been assigned.'}
            </p>
          )}
        </div>
      </section>

      {transitionHistory.length > 0 && (
        <section className="mx-auto w-full max-w-6xl rounded-2xl border border-outline-variant/70 bg-surface p-4">
          <h2 className="text-sm font-bold text-primary">Account transition history</h2>
          <ol className="mt-3 space-y-2">
            {transitionHistory.map((item) => (
              <li key={item.id} className="border-l-2 border-outline-variant pl-3 text-xs">
                <p className="font-semibold">{item.memberName} · {item.type.replaceAll('_', ' ').toLowerCase()}</p>
                <p className="text-on-surface-variant">{item.reason} · {new Date(item.occurredAt).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {detailMember && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailMember(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="member-details-title" className="w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-2xl dark:bg-[#0d1729] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="member-details-title" className="font-h3 text-xl text-primary">Attached member details</h2><p className="mt-1 text-sm font-semibold">{detailMember.fullName}</p></div>
              <button type="button" onClick={() => setDetailMember(null)} aria-label="Close member details" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['Relationship', detailMember.relationship || 'Family member'],
                ['Email', detailMember.email],
                ['Phone', detailMember.phone || 'Not provided'],
                ['Lineage', detailMember.lineage || 'Not provided'],
                ['Membership status', detailMember.status],
                ['Registration state', detailMember.registrationState.replaceAll('_', ' ')],
              ].map(([label, value]) => <div key={label} className="rounded-lg bg-surface-container-low p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}
            </dl>
            <button type="button" onClick={() => setDetailMember(null)} className="mt-5 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Close</button>
          </section>
        </div>
      )}

      {modalOpen && isPrincipal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setModalOpen(false)
          }}
        >
          <div className="relative max-h-[86vh] w-full max-w-md">
          <section
            ref={modalScrollRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-family-title"
            className="family-modal-scroll max-h-[86vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-2xl dark:bg-[#0d1729] sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="add-family-title" className="font-h3 text-xl text-primary dark:text-blue-100">Add family member</h2>
                <p className="mt-1 text-xs text-on-surface-variant">Choose how this person should join your branch.</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-50"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1 dark:bg-[#111f36]">
              {([
                ['LINK_EXISTING', 'Existing account'],
                ['INVITE_NEW', 'Invite new'],
                ['RECORD_ONLY', 'No login'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value)
                    setError('')
                    setOk('')
                  }}
                  className={mode === value
                    ? 'rounded-lg bg-surface px-2 py-2 text-xs font-semibold text-primary shadow-sm dark:bg-[#172743] dark:text-blue-100'
                    : 'rounded-lg px-2 py-2 text-xs text-on-surface-variant'}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2.5">
              <label className="block text-sm font-medium">
                Relationship
                <select value={relationship} onChange={(event) => setRelationship(event.target.value as Relationship)} className="mt-1 block h-9 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm dark:bg-[#111f36]">
                  {RELATIONSHIPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              {mode !== 'LINK_EXISTING' && (
                <label className="block text-sm font-medium">
                  Full name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm dark:bg-[#111f36]" required />
                </label>
              )}

              {(mode === 'LINK_EXISTING' || mode === 'INVITE_NEW') && (
                <label className="block text-sm font-medium">
                  Email {mode === 'LINK_EXISTING' && <span className="font-normal text-on-surface-variant">(existing member)</span>}
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm dark:bg-[#111f36]" required />
                </label>
              )}

              {mode !== 'LINK_EXISTING' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Phone number <span className="text-error">*</span>
                    <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm dark:bg-[#111f36]" required minLength={7} />
                  </label>
                  <label className="block text-sm font-medium">
                    Date of birth <span className="font-normal text-on-surface-variant">(optional)</span>
                    <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm dark:bg-[#111f36]" />
                  </label>
                </div>
              )}
              {mode !== 'LINK_EXISTING' && (
                <label className="block text-sm font-medium">
                  Lineage / family origin <span className="font-normal text-on-surface-variant">(optional)</span>
                  <textarea value={lineage} onChange={(event) => setLineage(event.target.value)} placeholder="Family lineage or origin" className="mt-1 min-h-14 w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm dark:bg-[#111f36]" />
                </label>
              )}

              {error && <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">The request needs your attention.</p>}
              {ok && !error && <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">{ok}</p>}
              {inviteUrl && <p className="break-all rounded-lg bg-surface-container-low p-3 text-xs">Invite link: {inviteUrl}</p>}

              <div className="flex justify-end gap-2 border-t border-outline-variant/60 pt-4">
                <button type="button" disabled={pending} onClick={() => setModalOpen(false)} className="h-10 rounded-lg border border-outline-variant px-4 text-sm font-semibold">Cancel</button>
                <button type="button" disabled={pending} onClick={submit} className="relative h-10 rounded-lg bg-secondary-container px-5 text-sm font-semibold text-transparent disabled:opacity-50">
                  {pending ? 'Saving…' : 'Add member'}
                  <span className="absolute inset-0 flex items-center justify-center text-on-primary">
                    {pending ? (mode === 'INVITE_NEW' ? 'Sending...' : 'Saving...') : mode === 'INVITE_NEW' ? 'Send invitation' : mode === 'LINK_EXISTING' ? 'Link member' : 'Save record'}
                  </span>
                </button>
              </div>
            </div>

            {pendingInvites.length > 0 && (
              <div className="mt-5 border-t border-outline-variant/60 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Pending invitations</p>
                <ul className="mt-2 space-y-2">
                  {pendingInvites.map((invite) => (
                    <li key={invite.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                      <span className="min-w-0 truncate">{invite.email} · expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                      <button type="button" className="shrink-0 font-semibold text-error" onClick={() => startTransition(async () => {
                        try {
                          await revokeFamilyInvite(invite.id)
                          router.refresh()
                        } catch (cause) {
                          setError(cause instanceof Error ? cause.message : 'Could not revoke invitation')
                        }
                      })}>Revoke</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          {modalScrollbar.visible && <span aria-hidden="true" className="pointer-events-none absolute right-px top-0 w-px rounded-full bg-[#ffc400]" style={{ height: modalScrollbar.height, transform: `translateY(${modalScrollbar.top}px)` }} />}
          </div>
        </div>
      )}
      {friendly && <ErrorDialog title={friendly.title} message={friendly.message} onClose={() => setError('')} />}
    </div>
  )
}
