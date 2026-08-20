'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { registerRequest } from '@/lib/auth/client'
import { PasswordVisibilityIcon } from '@/components/auth/AuthIcons'
import {
  EDUCATION_LEVELS,
  GENDERS,
  MEMBER_CATEGORIES,
  POLICY_VERSION,
  registrationSchema,
} from '@/lib/membership'

const STORAGE_KEY = 'alubonets-registration-draft-v1'
const steps = ['Verify email', 'Account', 'Personal', 'Family', 'Portfolio', 'Review']
const initial = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  location: '',
  gender: 'MALE',
  dateOfBirth: '',
  familyBranch: '',
  nextOfKinName: '',
  nextOfKinPhone: '',
  nextOfKinRelationship: '',
  profession: '',
  skills: '',
  educationLevel: 'SECONDARY',
  achievements: '',
  mentorshipArea: '',
  interests: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  memberCategory: 'ORDINARY',
}
const labels: Record<string, string> = {
  ORDINARY: 'Ordinary',
  COMMITTEE_MEMBER: 'Committee member',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  BACHELORS: "Bachelor's degree",
  MASTERS: "Master's degree",
}
const label = (value: string) =>
  labels[value] || value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())

type InvitePrefill = {
  token: string
  email: string
  fullName: string
  phone?: string | null
  principalName: string
  familyBranchHint?: string
}

export default function RegistrationWizard({
  onComplete,
  onSignIn,
  invite,
}: {
  onComplete: (fullName: string) => void
  onSignIn: () => void
  invite?: InvitePrefill | null
}) {
  const [form, setForm] = useState(initial)
  const [step, setStep] = useState(invite ? 1 : 0)
  const [emailVerified, setEmailVerified] = useState(Boolean(invite))
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sameAsKin, setSameAsKin] = useState(true)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)

  useEffect(() => {
    if (invite) {
      setForm((current) => ({
        ...current,
        email: invite.email,
        fullName: invite.fullName || current.fullName,
        phone: invite.phone || current.phone,
        familyBranch: invite.familyBranchHint || invite.principalName || current.familyBranch,
      }))
      setEmailVerified(true)
      setStep(1)
      setDraftLoaded(true)
      return
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved?.form) {
        setForm({ ...initial, ...saved.form, password: '' })
        if (saved.emailVerified) {
          setEmailVerified(true)
          setStep(1)
          setResumed(true)
        } else if (Number.isInteger(saved.step)) setStep(Math.min(Math.max(saved.step, 0), 5))
      }
      if (typeof saved?.sameAsKin === 'boolean') setSameAsKin(saved.sameAsKin)
      if (saved?.consentAccepted) setConsentAccepted(true)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setDraftLoaded(true)
    }
  }, [invite])

  useEffect(() => {
    if (!draftLoaded || invite) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        form: { ...form, password: '' },
        step,
        emailVerified,
        sameAsKin,
        consentAccepted,
      }),
    )
  }, [draftLoaded, form, step, emailVerified, sameAsKin, consentAccepted, invite])

  const set = (name: keyof typeof initial, value: string) => {
    if (name === 'email' && value !== form.email && !invite) {
      setEmailVerified(false)
      setCodeSent(false)
    }
    setForm((current) => ({ ...current, [name]: value }))
  }
  const fail = (message: string) => {
    setError(message)
    return false
  }
  const required = (fields: (keyof typeof initial)[]) => fields.every((field) => form[field].trim())

  function validate(current: number) {
    setError('')
    if (current === 0 && !emailVerified) return fail('Verify your email to continue.')
    if (current === 1) {
      if (!required(['fullName', 'phone', 'password'])) return fail('Complete all account fields.')
      if (form.password.length < 8) return fail('Password must be at least 8 characters.')
      if (
        !/[a-z]/.test(form.password) ||
        !/[A-Z]/.test(form.password) ||
        !/[0-9]/.test(form.password) ||
        !/[^A-Za-z0-9]/.test(form.password)
      ) {
        return fail('Password must include uppercase, lowercase, a number, and a special character.')
      }
      if (form.password !== confirmPassword) return fail('Passwords do not match.')
    }
    if (current === 2 && !required(['dateOfBirth', 'location']))
      return fail('Complete all personal information.')
    if (current === 3) {
      if (!required(['familyBranch', 'nextOfKinName', 'nextOfKinPhone', 'nextOfKinRelationship']))
        return fail('Complete all family information.')
      if (!sameAsKin && !required(['emergencyContactName', 'emergencyContactPhone']))
        return fail('Complete the emergency contact details.')
    }
    if (current === 4 && !required(['profession', 'skills', 'achievements', 'mentorshipArea', 'interests']))
      return fail('Complete all portfolio fields.')
    if (current === 5 && !consentAccepted) return fail('Accept the Terms and Privacy Policy to submit.')
    return true
  }

  async function request(method: 'POST' | 'PUT', body: object) {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register-email', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Email verification failed.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    if (await request('POST', { email: form.email })) setCodeSent(true)
  }

  async function verifyCode() {
    if (await request('PUT', { email: form.email, code })) {
      setEmailVerified(true)
      setStep(1)
      setCode('')
    }
  }

  async function submit() {
    if (!validate(5)) return
    if (!form.password) {
      setError('Return to the Account step and enter your password again before submitting.')
      return
    }
    const candidate = {
      ...form,
      emergencyContactName: sameAsKin ? form.nextOfKinName : form.emergencyContactName,
      emergencyContactPhone: sameAsKin ? form.nextOfKinPhone : form.emergencyContactPhone,
      consentAccepted,
      termsVersion: POLICY_VERSION,
      privacyVersion: POLICY_VERSION,
      ...(invite ? { inviteToken: invite.token } : {}),
    }
    const checked = registrationSchema.safeParse(candidate)
    if (!checked.success) {
      setError(checked.error.issues[0]?.message || 'Check your application details.')
      return
    }
    setLoading(true)
    try {
      await registerRequest(checked.data)
      localStorage.removeItem(STORAGE_KEY)
      onComplete(checked.data.fullName)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Registration failed.'
      if (message.toLowerCase().includes('verify your email')) {
        setEmailVerified(false)
        setCodeSent(false)
        setStep(0)
        setError('Your saved email verification has expired. Send a new code to continue.')
      } else setError(message)
    } finally {
      setLoading(false)
    }
  }

  const input = (name: keyof typeof initial, title: string, type = 'text', locked = false) => (
    <label className="block text-sm font-medium">
      {title} <span className="text-error">*</span>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        readOnly={locked}
        className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5 disabled:bg-surface-container"
        disabled={locked}
      />
    </label>
  )
  const area = (name: keyof typeof initial, title: string) => (
    <label className="block text-sm font-medium">
      {title} <span className="text-error">*</span>
      <textarea
        rows={2}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5"
      />
    </label>
  )
  const select = (name: keyof typeof initial, title: string, values: readonly string[]) => (
    <label className="block text-sm font-medium">
      {title} <span className="text-error">*</span>
      <select
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5"
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {label(v)}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="pr-8">
        <h2 className="font-h3 text-2xl text-primary">
          {invite ? 'Accept family invite' : 'Membership application'}
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Step {step + 1} of {steps.length}: {steps[step]}
        </p>
        {invite && (
          <p className="mt-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
            Invited by <strong>{invite.principalName}</strong>. Complete registration for{' '}
            <strong>{invite.email}</strong>. Admin approval may still be required.
          </p>
        )}
      </div>
      {resumed && (
        <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
          Welcome back. Your application was restored at the step where you stopped. For security,
          enter your password again before submitting.
        </p>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full bg-secondary-container transition-all"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="max-h-[58vh] overflow-y-auto px-1 py-1">
        {step === 0 && !invite && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              We verify your email first so you can safely continue this application later.
            </p>
            {input('email', 'Email address', 'email')}
            {codeSent && !emailVerified && (
              <label className="block text-sm font-medium">
                Six-digit code
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded-lg border px-3 py-2.5 text-center text-xl tracking-[.35em]"
                />
              </label>
            )}
            <div className="flex gap-2">
              {!emailVerified && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={codeSent ? verifyCode : sendCode}
                  className="auth-primary-btn"
                >
                  {loading ? 'Please wait…' : codeSent ? 'Verify code' : 'Send verification code'}
                </button>
              )}
              {codeSent && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={sendCode}
                  className="rounded-full border border-primary px-4 py-2 text-sm text-primary"
                >
                  Resend
                </button>
              )}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {input('fullName', 'Full name')}
            {input('phone', 'Phone', 'tel')}
            {input('email', 'Email address', 'email', Boolean(invite))}
            <label className="block text-sm font-medium">
              Password <span className="text-error">*</span>
              <span className="relative mt-1 block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-3 py-2.5 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-on-surface-variant hover:text-primary"
                >
                  <PasswordVisibilityIcon hidden={showPassword} />
                </button>
              </span>
            </label>
            <label className="block text-sm font-medium">
              Confirm password <span className="text-error">*</span>
              <span className="relative mt-1 block">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={
                    showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-on-surface-variant hover:text-primary"
                >
                  <PasswordVisibilityIcon hidden={showConfirmPassword} />
                </button>
              </span>
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {input('dateOfBirth', 'Date of birth', 'date')}
            {input('location', 'Location/address')}
            {select('gender', 'Gender', GENDERS)}
            {select('memberCategory', 'Member category', MEMBER_CATEGORIES)}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {input('familyBranch', 'Family branch/lineage')}
              {input('nextOfKinRelationship', 'Next-of-kin relationship')}
              {input('nextOfKinName', 'Next of kin name')}
              {input('nextOfKinPhone', 'Next of kin phone', 'tel')}
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={sameAsKin}
                onChange={(e) => setSameAsKin(e.target.checked)}
              />{' '}
              Use next of kin as emergency contact
            </label>
            {!sameAsKin && (
              <div className="grid gap-4 sm:grid-cols-2">
                {input('emergencyContactName', 'Emergency contact name')}
                {input('emergencyContactPhone', 'Emergency contact phone', 'tel')}
              </div>
            )}
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {input('profession', 'Profession/occupation')}
            {select('educationLevel', 'Education level', EDUCATION_LEVELS)}
            {area('skills', 'Skills')}
            {area('achievements', 'Achievements')}
            {area('mentorshipArea', 'Mentorship area')}
            {area('interests', 'Interests')}
          </div>
        )}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-container-low p-4 text-sm">
              <p>
                <b>Email:</b> {form.email} ✓
              </p>
              <p>
                <b>Name:</b> {form.fullName}
              </p>
              <p>
                <b>Phone:</b> {form.phone}
              </p>
              <p>
                <b>Family branch:</b> {form.familyBranch}
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-1"
              />
              <span>
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-primary underline">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="text-primary underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>
        )}
      </div>
      {error && <p className="rounded-lg bg-error-container p-3 text-sm text-error">{error}</p>}
      {step > 0 && (
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <button
            type="button"
            onClick={() => {
              setError('')
              setStep(step - 1)
            }}
            className="rounded-full border border-primary px-5 py-2 text-sm text-primary"
            disabled={Boolean(invite) && step === 1}
          >
            Back
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => (step === 5 ? submit() : validate(step) && setStep(step + 1))}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            {loading ? 'Submitting…' : step === 5 ? 'Submit application' : 'Next step'}
          </button>
        </div>
      )}
      <p className="text-center text-xs text-on-surface-variant">
        Already registered?{' '}
        <button type="button" onClick={onSignIn} className="auth-link-accent">
          Sign in
        </button>
      </p>
    </div>
  )
}
