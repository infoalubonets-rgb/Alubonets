'use client'

import { useState, type FormEvent } from 'react'
import { updateMyMemberDetails } from '@/app/actions/profile'
import { EDUCATION_LEVELS } from '@/lib/membership'

type Details = {
  phone: string
  location: string
  familyBranch: string
  nextOfKinName: string
  nextOfKinPhone: string
  nextOfKinRelationship: string
  profession: string
  skills: string
  achievements: string
  mentorshipArea: string
  interests: string
  emergencyContactName: string
  emergencyContactPhone: string
  educationLevel: typeof EDUCATION_LEVELS[number]
}

export default function MemberDetailsForm({ data }: { data: Details }) {
  const [form, setForm] = useState(data)
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editingField, setEditingField] = useState<keyof Details | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (name: keyof Details, value: string) =>
    setForm((current) => ({ ...current, [name]: value }))

  function cancelEditing() {
    setForm(data)
    setEditingField(null)
    setMessage('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await updateMyMemberDetails(form)
      setMessage('Profile details updated.')
      setEditingField(null)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const editButton = (name: keyof Details, title: string) => (
    <button
      type="button"
      onClick={() => {
        setEditingField(name)
        setVisible(true)
        setMessage('')
      }}
      disabled={editingField !== null}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-container/10 text-secondary transition hover:bg-secondary-container hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-35"
      aria-label={`Edit ${title}`}
      title={`Edit ${title}`}
    >
      <span className="material-symbols-outlined text-[15px]">edit</span>
    </button>
  )

  const fieldActions = () => (
    <div className="mt-2 flex justify-end gap-1.5">
      <button type="button" onClick={cancelEditing} className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low" aria-label="Cancel edit" title="Cancel">
        <span className="material-symbols-outlined text-[17px]">close</span>
      </button>
      <button type="submit" disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.25)] disabled:opacity-60" aria-label="Save field" title="Save">
        <span className="material-symbols-outlined text-[17px]">{saving ? 'progress_activity' : 'check'}</span>
      </button>
    </div>
  )

  const field = (name: keyof Details, title: string, type = 'text') => (
    <div className="block min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-label-bold uppercase tracking-[0.1em] text-on-surface-variant">
          {title}
        </span>
        {editingField !== name && editButton(name, title)}
      </div>
      {editingField === name ? (
        <label>
          <span className="sr-only">{title}</span>
        <input
          type={type}
          required
          value={form[name]}
          onChange={(event) => set(name, event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20"
          autoFocus
        />
          {fieldActions()}
        </label>
      ) : (
        <p className="mt-1 break-words text-sm font-medium text-on-surface">
          {form[name] || 'Not provided'}
        </p>
      )}
    </div>
  )

  const area = (name: keyof Details, title: string) => (
    <div className="block min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-label-bold uppercase tracking-[0.1em] text-on-surface-variant">
          {title}
        </span>
        {editingField !== name && editButton(name, title)}
      </div>
      {editingField === name ? (
        <label>
          <span className="sr-only">{title}</span>
        <textarea
          required
          value={form[name]}
          onChange={(event) => set(name, event.target.value)}
          rows={3}
          className="mt-1.5 w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20"
          autoFocus
        />
          {fieldActions()}
        </label>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-on-surface">
          {form[name] || 'Not provided'}
        </p>
      )}
    </div>
  )

  return (
    <section className="mx-auto mt-5 max-w-lg overflow-hidden rounded-[26px] border border-outline-variant/60 bg-surface-container-lowest shadow-[0_10px_32px_rgba(0,31,80,0.1)]">
      <div className="h-1.5 bg-secondary-container" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[0_5px_16px_rgba(0,31,80,0.18)]">
            <span className="material-symbols-outlined text-[24px]">badge</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="min-w-0 flex-1 text-left"
            aria-expanded={expanded}
          >
            <p className="text-[10px] font-label-bold uppercase tracking-[0.13em] text-secondary">
              Private profile
            </p>
            <h2 className="mt-0.5 font-h3 text-xl text-primary">Personal, family & portfolio details</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              {expanded ? 'Tap the arrow to close your details' : 'Tap to view all your details'}
            </p>
          </button>

          {expanded && (
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-low text-primary transition hover:bg-primary/5"
              aria-label={visible ? 'Hide private details' : 'Reveal private details'}
              title={visible ? 'Hide private details' : 'Reveal private details'}
            >
              <span className="material-symbols-outlined text-[21px]">
                {visible ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          )}

          <button type="button" onClick={() => setExpanded((current) => !current)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary transition hover:bg-primary/10" aria-label={expanded ? 'Collapse profile details' : 'Expand profile details'}>
            <span className="material-symbols-outlined text-[22px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>

        {expanded && (
          <form onSubmit={submit} className="mt-5 border-t border-outline-variant/40 pt-5">
            <div className="relative">
              <div
                className={`space-y-7 transition-all duration-300 ${
                  visible ? 'blur-0 opacity-100' : 'pointer-events-none select-none blur-[6px] opacity-40'
                }`}
                aria-hidden={!visible}
              >
                <div>
                  <div className="mb-4 flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[19px]">person</span>
                    <h3 className="font-label-bold text-sm">Personal details</h3>
                  </div>
                  <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {field('phone', 'Phone', 'tel')}
                    {field('location', 'Location / address')}
                    {field('familyBranch', 'Family branch')}
                  </div>
                </div>

                <div className="border-t border-outline-variant/40 pt-5">
                  <div className="mb-4 flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[19px]">family_restroom</span>
                    <h3 className="font-label-bold text-sm">Family & emergency</h3>
                  </div>
                  <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {field('nextOfKinName', 'Next of kin')}
                    {field('nextOfKinRelationship', 'Relationship')}
                    {field('nextOfKinPhone', 'Next-of-kin phone', 'tel')}
                    {field('emergencyContactName', 'Emergency contact')}
                    {field('emergencyContactPhone', 'Emergency phone', 'tel')}
                  </div>
                </div>

                <div className="border-t border-outline-variant/40 pt-5">
                  <div className="mb-4 flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[19px]">workspace_premium</span>
                    <h3 className="font-label-bold text-sm">Portfolio</h3>
                  </div>
                  <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {field('profession', 'Profession')}
                    <div className="block min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-label-bold uppercase tracking-[0.1em] text-on-surface-variant">Education level</span>
                        {editingField !== 'educationLevel' && editButton('educationLevel', 'education level')}
                      </div>
                      {editingField === 'educationLevel' ? (
                        <label>
                          <span className="sr-only">Education level</span>
                        <select value={form.educationLevel} onChange={(event) => set('educationLevel', event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20">
                          {EDUCATION_LEVELS.map((value) => <option key={value}>{value}</option>)}
                        </select>
                          {fieldActions()}
                        </label>
                      ) : <p className="mt-1 text-sm font-medium text-on-surface">{form.educationLevel}</p>}
                    </div>
                    {area('skills', 'Skills')}
                    {area('achievements', 'Achievements')}
                    {area('mentorshipArea', 'Mentorship area')}
                    {area('interests', 'Interests')}
                  </div>
                </div>
              </div>

              {!visible && (
                <button type="button" onClick={() => setVisible(true)} className="absolute inset-0 flex w-full items-center justify-center rounded-2xl bg-surface-container-lowest/25" aria-label="Reveal private profile details">
                  <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-label-bold text-primary shadow-sm">
                    <span className="material-symbols-outlined text-[17px]">lock</span>
                    Private · Tap to reveal
                  </span>
                </button>
              )}
            </div>

          </form>
        )}

        {message && <p role="status" className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">{message}</p>}
      </div>
    </section>
  )
}
