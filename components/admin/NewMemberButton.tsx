'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { PasswordVisibilityIcon } from '@/components/auth/AuthIcons'
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

const GENDERS = [['', 'Not given'], ['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other'], ['PREFER_NOT_TO_SAY', 'Prefer not to say']] as const
const EDUCATION = [
  ['', 'Not given'], ['PRIMARY', 'Primary'], ['SECONDARY', 'Secondary'], ['CERTIFICATE', 'Certificate'], ['DIPLOMA', 'Diploma'],
  ['BACHELORS', 'Bachelor’s'], ['MASTERS', 'Master’s'], ['DOCTORATE', 'Doctorate'], ['OTHER', 'Other'],
] as const

/** Optional details for a minor's record, grouped into steps like member registration. */
const MINOR_STEPS = [
  { title: 'Basics', fields: [] },
  {
    title: 'Personal',
    fields: [
      ['gender', 'Gender', 'gender'],
      ['location', 'Location', 'text'],
      ['address', 'Address', 'text'],
      ['phone', 'Phone', 'tel'],
    ],
  },
  {
    title: 'Contacts',
    fields: [
      ['nextOfKinName', 'Next of kin name', 'text'],
      ['nextOfKinPhone', 'Next of kin phone', 'tel'],
      ['nextOfKinRelationship', 'Next of kin relationship', 'text'],
      ['emergencyContactName', 'Emergency contact name', 'text'],
      ['emergencyContactPhone', 'Emergency contact phone', 'tel'],
    ],
  },
  {
    title: 'Portfolio',
    fields: [
      ['educationLevel', 'Education level', 'education'],
      ['profession', 'School or occupation', 'text'],
      ['skills', 'Skills', 'textarea'],
      ['interests', 'Interests', 'textarea'],
      ['achievements', 'Achievements', 'textarea'],
      ['mentorshipArea', 'Mentorship area', 'text'],
    ],
  },
] as const

const PROFILE_KEYS = MINOR_STEPS.flatMap((step) => step.fields.map(([key]) => key)).filter((key) => key !== 'phone')

const FIELD = 'mt-1 block w-full rounded-lg border px-3 py-2 font-normal'
const LABEL = 'text-sm font-semibold text-on-surface'
const OPTIONAL = <span className="font-normal text-on-surface-variant">(optional)</span>

/** A random temporary password that already meets the site's password rules. */
function temporaryPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?']
  const random = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max
  const all = sets.join('')
  const chars = [...sets.map((set) => set[random(set.length)]), ...Array.from({ length: 8 }, () => all[random(all.length)])]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

type Done = {
  name: string
  minor: boolean
  emailed: boolean
  emailedTo: string | null
  testInbox: boolean
  emailError: string | null
  setupUrl: string | null
  password: string
}

/**
 * Admin "+ New member".
 * - Adult: email + temporary password; a setup link is emailed and shown to copy. The member sets
 *   their own password from it and is asked to complete My profile.
 * - Minor: a family record without a login; every extra detail is optional, filled in steps.
 */
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
  const [done, setDone] = useState<Done | null>(null)
  const [copied, setCopied] = useState(false)
  const [minor, setMinor] = useState(false)
  const [step, setStep] = useState(0)
  const [family, setFamily] = useState<'none' | 'principal' | 'attached'>('none')
  const [showPassword, setShowPassword] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  const value = (key: string) => values[key] ?? ''
  const set = (key: string) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: event.target.value }))

  function reset() {
    setError('')
    setDone(null)
    setCopied(false)
    setMinor(false)
    setStep(0)
    setFamily('none')
    setShowPassword(false)
    setValues({ password: temporaryPassword(), role: 'MEMBER', relationship: 'SPOUSE' })
  }

  function openModal() {
    reset()
    setOpen(true)
  }

  function close() {
    if (pending) return
    setOpen(false)
  }

  function chooseMinor(next: boolean) {
    setMinor(next)
    setStep(0)
    // A minor cannot head a family branch.
    if (next && family === 'principal') setFamily('none')
  }

  const lastStep = minor ? MINOR_STEPS.length - 1 : 0

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < lastStep) return setStep(step + 1)
    setError('')
    const name = value('fullName').trim()
    const password = value('password')
    startTransition(async () => {
      try {
        const result = await adminCreateMember({
          isMinor: minor,
          fullName: name,
          email: minor ? undefined : value('email'),
          phone: value('phone'),
          password: minor ? undefined : password,
          role: minor ? 'MEMBER' : (value('role') as Role),
          isPrincipal: !minor && family === 'principal',
          principalId: family === 'attached' ? value('principalId') || undefined : undefined,
          relationship: family === 'attached' ? (value('relationship') as (typeof RELATIONSHIPS)[number][0]) : undefined,
          dateOfBirth: value('dateOfBirth') || undefined,
          profile: minor ? Object.fromEntries(PROFILE_KEYS.map((key) => [key, value(key)])) : {},
        })
        if (!result.ok) {
          setError(result.error)
          return
        }
        setDone({
          name,
          minor: result.minor,
          emailed: result.emailed,
          emailedTo: result.emailedTo,
          testInbox: result.emailRedirectedToTestInbox,
          emailError: result.emailError,
          setupUrl: result.setupUrl,
          password,
        })
        router.refresh()
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
      }
    })
  }

  async function copyLink() {
    if (!done?.setupUrl) return
    try {
      await navigator.clipboard.writeText(done.setupUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const familyOptions = [
    ['none', 'Independent member'],
    ...(minor ? [] : [['principal', 'Principal Member']]),
    ['attached', 'Attach to a Principal'],
  ] as [typeof family, string][]

  return (
    <>
      <button type="button" onClick={openModal} className={className}>
        <span className="material-symbols-outlined text-[16px]">person_add</span>
        New member
      </button>
      <FullScreenModal open={open} title="New member" onClose={close} size="compact">
        {done ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <span className="material-symbols-outlined">check_circle</span>
              {done.name}&apos;s account is ready{done.minor ? ' (minor record only, no login).' : '.'}
            </p>
            {done.setupUrl && (
              <>
                {done.emailed && !done.testInbox && (
                  <p className="rounded-lg bg-green-50 p-2 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    Welcome email with the setup link and temporary password sent to <b>{done.emailedTo}</b>.
                  </p>
                )}
                {done.emailed && done.testInbox && (
                  <p className="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    The email went to the test inbox <b>{done.emailedTo}</b>, not to the member, because test mode is on
                    (RESEND_TEST_EMAIL is set in Vercel). Remove it there and redeploy so members get their own emails.
                    Until then, share the link below yourself.
                  </p>
                )}
                {!done.emailed && (
                  <p className="rounded-lg bg-error-container p-2 text-error">
                    The account was saved. The welcome email did not go out{done.emailError ? `: ${done.emailError}` : '.'} Copy the link below and share it with them yourself.
                  </p>
                )}
                <p className="text-on-surface-variant">
                  The link works once, for 14 days. Opening it lets them choose their own password, then they complete their profile.
                </p>
                <div className="flex items-stretch gap-2">
                  <span className="min-w-0 flex-1 break-all rounded-lg bg-surface-container-low p-2 font-mono text-xs">{done.setupUrl}</span>
                  <button type="button" onClick={copyLink} className="flex shrink-0 items-center gap-1 rounded-lg border px-3 font-semibold">
                    <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Temporary password: <span className="font-mono">{done.password}</span>. They can also sign in with it, but the setup link is the easier way.
                </p>
              </>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={reset} className="rounded-full border px-4 py-2 font-semibold">Add another</button>
              <button type="button" onClick={close} className="rounded-full bg-primary px-4 py-2 font-semibold text-on-primary">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            {step === 0 && (
              <>
                <fieldset className="sm:col-span-2">
                  <legend className={LABEL}>Type of member</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {([[false, 'Adult (with login)'], [true, 'Minor (record only)']] as const).map(([isMinor, label]) => (
                      <label key={label} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${minor === isMinor ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>
                        <input type="radio" name="memberType" checked={minor === isMinor} onChange={() => chooseMinor(isMinor)} className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={`${LABEL} sm:col-span-2`}>Full name<input value={value('fullName')} onChange={set('fullName')} required minLength={2} className={FIELD} /></label>
                {!minor && (
                  <>
                    <label className={LABEL}>Email<input value={value('email')} onChange={set('email')} type="email" required autoComplete="off" className={FIELD} /></label>
                    <label className={LABEL}>Phone<input value={value('phone')} onChange={set('phone')} type="tel" required minLength={7} className={FIELD} /></label>
                    <label className={`${LABEL} sm:col-span-2`}>
                      Temporary password
                      <span className="relative mt-1 flex gap-2">
                        <span className="relative flex-1">
                          <input
                            value={value('password')}
                            onChange={set('password')}
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            className="block w-full rounded-lg border px-3 py-2 pr-11 font-mono font-normal"
                          />
                          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
                            <PasswordVisibilityIcon hidden={showPassword} />
                          </button>
                        </span>
                        <button type="button" onClick={() => setValues((v) => ({ ...v, password: temporaryPassword() }))} title="Generate a new password" className="rounded-lg border px-3 text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">refresh</span>
                        </button>
                      </span>
                      <span className="mt-1 block text-xs font-normal text-on-surface-variant">Filled in for you; change it if you like. The member replaces it from their setup link.</span>
                    </label>
                    <label className={LABEL}>
                      Role
                      <select value={value('role')} onChange={set('role')} className={FIELD}>
                        {(Object.keys(ROLE_LABEL) as Role[])
                          .filter((role) => role !== 'ADMIN' || canAddAdmins)
                          .map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <label className={LABEL}>
                  Date of birth {OPTIONAL}
                  <input value={value('dateOfBirth')} onChange={set('dateOfBirth')} type="date" max={todayInputValue()} className={FIELD} />
                </label>
                <fieldset className="sm:col-span-2">
                  <legend className={LABEL}>Family branch</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {familyOptions.map(([option, label]) => (
                      <label key={option} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${family === option ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>
                        <input type="radio" name="family" checked={family === option} onChange={() => setFamily(option)} className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {family === 'attached' && (
                  <>
                    <label className={LABEL}>
                      Principal Member
                      <select value={value('principalId')} onChange={set('principalId')} required className={FIELD}>
                        <option value="" disabled>Choose…</option>
                        {principals.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                      </select>
                    </label>
                    <label className={LABEL}>
                      Relationship
                      <select value={value('relationship')} onChange={set('relationship')} required className={FIELD}>
                        {RELATIONSHIPS.map(([option, label]) => <option key={option} value={option}>{label}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <p className="text-xs text-on-surface-variant sm:col-span-2">
                  {minor
                    ? 'A minor gets a member record without a login. Only the name is required; the next steps are optional.'
                    : 'The account is approved straight away. They get a setup link to choose their own password, then fill in the rest of their profile themselves.'}
                  {family === 'attached' ? ' Their Principal is notified too.' : ''}
                </p>
              </>
            )}

            {minor && step > 0 && (
              <>
                <p className="text-xs text-on-surface-variant sm:col-span-2">All of these are optional. Leave anything you don’t know empty.</p>
                {MINOR_STEPS[step].fields.map(([key, label, kind]) => (
                  <label key={key} className={`${LABEL} ${kind === 'textarea' ? 'sm:col-span-2' : ''}`}>
                    {label}
                    {kind === 'gender' || kind === 'education' ? (
                      <select value={value(key)} onChange={set(key)} className={FIELD}>
                        {(kind === 'gender' ? GENDERS : EDUCATION).map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                      </select>
                    ) : kind === 'textarea' ? (
                      <textarea value={value(key)} onChange={set(key)} rows={2} maxLength={500} className={FIELD} />
                    ) : (
                      <input value={value(key)} onChange={set(key)} type={kind} className={FIELD} />
                    )}
                  </label>
                ))}
              </>
            )}

            {minor && (
              <ol className="flex flex-wrap gap-1.5 text-xs sm:col-span-2" aria-label="Steps">
                {MINOR_STEPS.map((s, index) => (
                  <li key={s.title}>
                    <button
                      type="button"
                      onClick={() => setStep(index)}
                      disabled={index > 0 && value('fullName').trim().length < 2}
                      className={`rounded-full px-2.5 py-1 font-semibold disabled:opacity-40 ${index === step ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
                    >
                      {index + 1}. {s.title}
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={step > 0 ? () => setStep(step - 1) : close} disabled={pending} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {step > 0 ? 'Back' : 'Cancel'}
              </button>
              {minor && step < lastStep && (
                <button type="button" onClick={() => setStep(lastStep)} className="rounded-full px-3 py-2 text-sm font-semibold text-primary">
                  Skip to end
                </button>
              )}
              <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
                {pending ? 'Adding…' : step < lastStep ? 'Next' : minor ? 'Add minor' : 'Add member and create link'}
              </button>
            </div>
          </form>
        )}
      </FullScreenModal>
    </>
  )
}
