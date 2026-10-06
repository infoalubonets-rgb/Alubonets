'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { adminCreateMember } from '@/app/actions/member-admin'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'
import { todayInputValue } from '@/lib/dates'

const RELATIONSHIPS = [
  ['SPOUSE', 'Spouse'],
  ['SON', 'Son'],
  ['DAUGHTER', 'Daughter'],
  ['CHILD', 'Child'],
  ['DEPENDENT', 'Dependent'],
  ['OTHER', 'Other'],
] as const

const FIELD = 'mt-1 block w-full rounded-lg border px-3 py-2 font-normal'

/** Admin "+ New member": adds an approved member, optionally as a Principal or under one. */
export default function NewMemberButton({
  principals,
  className,
  canAddAdmins = false,
}: {
  principals: { id: string; fullName: string }[]
  className: string
  /** Only a Super Admin may create Administrators. */
  canAddAdmins?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ name: string; emailed: boolean; registerUrl?: string } | null>(null)
  const [family, setFamily] = useState<'none' | 'principal' | 'attached'>('none')

  function close() {
    if (pending) return
    setOpen(false)
    setError('')
    setDone(null)
    setFamily('none')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '').trim()
    setError('')
    startTransition(async () => {
      try {
        const result = await adminCreateMember({
          fullName: value('fullName'),
          email: value('email'),
          phone: value('phone'),
          role: value('role') as Role,
          isPrincipal: family === 'principal',
          principalId: family === 'attached' ? value('principalId') || undefined : undefined,
          relationship: family === 'attached' ? (value('relationship') as (typeof RELATIONSHIPS)[number][0]) : undefined,
          dateOfBirth: value('dateOfBirth') || undefined,
        })
        setDone({ name: value('fullName'), emailed: result.emailed, registerUrl: result.registerUrl })
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add the member.')
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <span className="material-symbols-outlined text-[16px]">person_add</span>
        New member
      </button>
      <FullScreenModal open={open} title="New member" onClose={close} size="compact">
        {done ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <span className="material-symbols-outlined">check_circle</span>
              {done.name} was added and approved.
            </p>
            {done.emailed ? (
              <p className="text-on-surface-variant">They were emailed a link to create their login. It works for 14 days.</p>
            ) : (
              <p className="text-on-surface-variant">
                Email is not set up, so share this link with them to create their login:
                <span className="mt-1 block break-all rounded-lg bg-surface-container-low p-2 font-mono text-xs">{done.registerUrl}</span>
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setDone(null); setFamily('none') }} className="rounded-full border px-4 py-2 font-semibold">Add another</button>
              <button type="button" onClick={close} className="rounded-full bg-primary px-4 py-2 font-semibold text-on-primary">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-on-surface sm:col-span-2">Full name<input name="fullName" required minLength={2} className={FIELD} /></label>
            <label className="text-sm font-semibold text-on-surface">Email<input name="email" type="email" required className={FIELD} /></label>
            <label className="text-sm font-semibold text-on-surface">Phone<input name="phone" required minLength={7} className={FIELD} /></label>
            <label className="text-sm font-semibold text-on-surface">
              Role
              <select name="role" defaultValue="MEMBER" className={FIELD}>
                {(Object.keys(ROLE_LABEL) as Role[])
                  .filter((role) => role !== 'ADMIN' || canAddAdmins)
                  .map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-on-surface">
              Date of birth <span className="font-normal text-on-surface-variant">(optional)</span>
              <input name="dateOfBirth" type="date" max={todayInputValue()} className={FIELD} />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold text-on-surface">Family branch</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {([['none', 'Independent member'], ['principal', 'Principal Member'], ['attached', 'Attach to a Principal']] as const).map(([value, label]) => (
                  <label key={value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${family === value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>
                    <input type="radio" name="family" value={value} checked={family === value} onChange={() => setFamily(value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {family === 'attached' && (
              <>
                <label className="text-sm font-semibold text-on-surface">
                  Principal Member
                  <select name="principalId" required className={FIELD} defaultValue="">
                    <option value="" disabled>Choose…</option>
                    {principals.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-on-surface">
                  Relationship
                  <select name="relationship" required className={FIELD} defaultValue="SPOUSE">
                    {RELATIONSHIPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </>
            )}
            <p className="text-xs text-on-surface-variant sm:col-span-2">
              The member is approved straight away and emailed a link to create their login.
              {family === 'attached' ? ' Their Principal is notified too.' : ''}
            </p>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={close} disabled={pending} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
              <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
                {pending ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </form>
        )}
      </FullScreenModal>
    </>
  )
}
