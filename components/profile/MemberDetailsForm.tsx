'use client'

import { useState, type FormEvent } from 'react'
import { updateMyAvatarPath, updateMyMemberDetails } from '@/app/actions/profile'
import { EDUCATION_LEVELS } from '@/lib/membership'
import { createClient } from '@/utils/supabase/client'

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
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (name: keyof Details, value: string) => setForm((current) => ({ ...current, [name]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateMyMemberDetails(form)
      setMessage('Profile details updated.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(file: File) {
    setMessage('Uploading profile image…')
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return setMessage('Please sign in again.')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${auth.user.id}/avatar.${extension}`
    const { error } = await supabase.storage.from('member-avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) return setMessage(error.message)
    await updateMyAvatarPath(path)
    setMessage('Profile image updated.')
  }

  const input = (name: keyof Details, title: string, type = 'text') => <label className="text-sm">{title}<input type={type} required value={form[name]} onChange={(e) => set(name, e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
  const area = (name: keyof Details, title: string) => <label className="text-sm">{title}<textarea required value={form[name]} onChange={(e) => set(name, e.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>

  return <section className="mx-auto mt-4 max-w-lg rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-xl text-primary">Personal, family and portfolio details</h2><label className="mt-4 block text-sm">Secure profile image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} className="mt-1 block w-full text-sm" /></label><form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">{input('phone', 'Phone', 'tel')}{input('location', 'Location/address')}{input('familyBranch', 'Family branch')}{input('nextOfKinRelationship', 'Next-of-kin relationship')}{input('nextOfKinName', 'Next of kin')}{input('nextOfKinPhone', 'Next-of-kin phone', 'tel')}{input('emergencyContactName', 'Emergency contact')}{input('emergencyContactPhone', 'Emergency phone', 'tel')}{input('profession', 'Profession')}<label className="text-sm">Education level<select value={form.educationLevel} onChange={(e) => set('educationLevel', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{EDUCATION_LEVELS.map((value) => <option key={value}>{value}</option>)}</select></label>{area('skills', 'Skills')}{area('achievements', 'Achievements')}{area('mentorshipArea', 'Mentorship area')}{area('interests', 'Interests')}<div className="md:col-span-2"><button disabled={saving} className="rounded-full bg-primary px-5 py-2.5 text-on-primary disabled:opacity-60">{saving ? 'Saving…' : 'Save profile details'}</button>{message && <p className="mt-2 text-sm">{message}</p>}</div></form></section>
}
