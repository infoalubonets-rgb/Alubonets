'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { registerRequest } from '@/lib/auth/client'
import {
  EDUCATION_LEVELS,
  GENDERS,
  MEMBER_CATEGORIES,
  POLICY_VERSION,
  type RegistrationInput,
} from '@/lib/membership'

const labels: Record<string, string> = {
  ORDINARY: 'Ordinary',
  COMMITTEE_MEMBER: 'Committee member',
  ADMIN: 'Admin',
  EXECUTIVE: 'Executive',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  ORGANIZER: 'Organizer',
  MEMBER: 'Member',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  BACHELORS: "Bachelor's degree",
  MASTERS: "Master's degree",
  DOCTORATE: 'Doctorate',
}
const label = (value: string) =>
  labels[value] || value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())

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

export default function RegistrationForm() {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [sameAsKin, setSameAsKin] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (name: keyof typeof initial, value: string) =>
    setForm((current) => ({ ...current, [name]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (form.password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const payload = {
        ...form,
        emergencyContactName: sameAsKin ? form.nextOfKinName : form.emergencyContactName,
        emergencyContactPhone: sameAsKin ? form.nextOfKinPhone : form.emergencyContactPhone,
        consentAccepted,
        termsVersion: POLICY_VERSION,
        privacyVersion: POLICY_VERSION,
      } as unknown as RegistrationInput
      const result = await registerRequest(payload)
      router.push(result.redirectTo || '/pending')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const input = (name: keyof typeof initial, title: string, type = 'text') => (
    <label className="block text-sm font-medium">
      {title} <span className="text-error">*</span>
      <input
        type={type}
        value={form[name]}
        onChange={(event) => set(name, event.target.value)}
        required
        className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5"
      />
    </label>
  )
  const area = (name: keyof typeof initial, title: string) => (
    <label className="block text-sm font-medium">
      {title} <span className="text-error">*</span>
      <textarea
        value={form[name]}
        onChange={(event) => set(name, event.target.value)}
        required
        rows={3}
        className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5"
      />
    </label>
  )

  return (
    <main className="min-h-screen bg-surface-container-low px-4 py-10">
      <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="font-h2 text-3xl text-primary">Membership application</h1>
          <p className="mt-2 text-on-surface-variant">
            Complete every field. An administrator must approve your application before portal access.
          </p>
        </header>

        <Section title="Account">
          <div className="grid gap-4 md:grid-cols-2">
            {input('email', 'Email', 'email')}
            {input('phone', 'Phone', 'tel')}
            {input('password', 'Password', 'password')}
            <label className="block text-sm font-medium">
              Confirm password <span className="text-error">*</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5" />
            </label>
          </div>
        </Section>

        <Section title="Personal information">
          <div className="grid gap-4 md:grid-cols-2">
            {input('fullName', 'Full name')}
            {input('dateOfBirth', 'Date of birth', 'date')}
            <SelectField title="Gender" value={form.gender} values={GENDERS} onChange={(v) => set('gender', v)} />
            {input('location', 'Location/address')}
            <SelectField title="Member category" value={form.memberCategory} values={MEMBER_CATEGORIES} onChange={(v) => set('memberCategory', v)} />
          </div>
        </Section>

        <Section title="Family and emergency information">
          <div className="grid gap-4 md:grid-cols-2">
            {input('familyBranch', 'Family branch/lineage')}
            {input('nextOfKinRelationship', 'Next-of-kin relationship')}
            {input('nextOfKinName', 'Next of kin name')}
            {input('nextOfKinPhone', 'Next of kin phone', 'tel')}
          </div>
          <label className="mt-4 flex gap-2 text-sm">
            <input type="checkbox" checked={sameAsKin} onChange={(e) => setSameAsKin(e.target.checked)} />
            Use next of kin as emergency contact
          </label>
          {!sameAsKin && <div className="mt-4 grid gap-4 md:grid-cols-2">{input('emergencyContactName', 'Emergency contact name')}{input('emergencyContactPhone', 'Emergency contact phone', 'tel')}</div>}
        </Section>

        <Section title="Portfolio">
          <div className="grid gap-4 md:grid-cols-2">
            {input('profession', 'Profession/occupation')}
            <SelectField title="Education level" value={form.educationLevel} values={EDUCATION_LEVELS} onChange={(v) => set('educationLevel', v)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {area('skills', 'Skills')}
            {area('achievements', 'Achievements')}
            {area('mentorshipArea', 'Mentorship area')}
            {area('interests', 'Interests')}
          </div>
        </Section>

        <Section title="Consent">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} required className="mt-1" />
            <span>I have read and agree to the <Link href="/terms" target="_blank" className="text-primary underline">Terms of Use</Link> and <Link href="/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link> (version {POLICY_VERSION}).</span>
          </label>
        </Section>

        {error && <p className="rounded-lg bg-error-container p-3 text-error">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button disabled={loading} className="rounded-full bg-primary px-6 py-3 font-semibold text-on-primary disabled:opacity-60">{loading ? 'Submitting…' : 'Submit application'}</button>
          <Link href="/login" className="rounded-full border border-primary px-6 py-3 text-primary">Back to login</Link>
        </div>
      </form>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-surface p-5 shadow-sm"><h2 className="mb-4 font-h3 text-xl text-primary">{title}</h2>{children}</section>
}

function SelectField({ title, value, values, onChange }: { title: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{title} <span className="text-error">*</span><select value={value} onChange={(e) => onChange(e.target.value)} required className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2.5">{values.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
}
