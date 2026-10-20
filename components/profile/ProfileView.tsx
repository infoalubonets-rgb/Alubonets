'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { updateMyAvatarPath, updateMyProfile } from '@/app/actions/profile'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'
import { createClient } from '@/utils/supabase/client'

async function optimizeAvatar(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')

  const bitmap = await createImageBitmap(file)
  const maxSide = 1200
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare this image.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Could not optimize this image.')),
      'image/webp',
      0.82,
    )
  })
  return new File([blob], 'avatar.webp', { type: 'image/webp' })
}

export type ProfileViewData = {
  id: string
  fullName: string
  email: string
  phone: string | null
  location: string | null
  avatarUrl: string | null
  role: Role
  status: string
  isSuperAdmin: boolean
  initials: string
  /** Permanent member ID, e.g. AL2608-001. */
  memberId: string | null
  /** PJW / PJW01; null when not in a family. */
  familyTag: string | null
  contributionCount: number
  contributionTotal: number
  welfareCount: number
}

export default function ProfileView({ data }: { data: ProfileViewData }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState(data.fullName)
  const [phone, setPhone] = useState(data.phone ?? '')
  const [location, setLocation] = useState(data.location ?? '')
  const [viewingAvatar, setViewingAvatar] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const locationLine = data.location?.trim() || 'Alubonets SHG · Kenya'

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateMyProfile({
        fullName,
        phone: phone || null,
        location: location || null,
      })
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const changeAvatar = async (file: File) => {
    setUploadingAvatar(true)
    setError('')
    try {
      const optimized = await optimizeAvatar(file)
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Please sign in again.')
      const path = `${auth.user.id}/avatar.webp`
      const { error: uploadError } = await supabase.storage
        .from('member-avatars')
        .upload(path, optimized, { upsert: true, contentType: optimized.type })
      if (uploadError) throw uploadError
      await updateMyAvatarPath(path)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update profile image.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-16 space-y-4">
      <section className="relative pt-2">
        <div className="absolute inset-x-0 top-0 h-[140px] rounded-t-[28px] bg-primary">
          <div className="absolute bottom-0 inset-x-0 h-1 bg-secondary-container" />
        </div>

        <div className="relative mt-[72px] bg-surface-container-lowest rounded-[28px] shadow-[0_12px_40px_rgba(0,31,80,0.12)] px-5 pt-2 pb-6">
          <div className="flex justify-center -mt-[52px] mb-1">
            <div className="group relative h-[104px] w-[104px] rounded-full focus-within:ring-4 focus-within:ring-secondary-container/30">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={`${data.fullName}'s profile`}
                  className="h-[104px] w-[104px] rounded-full object-cover border-[5px] border-white shadow-lg bg-surface-container"
                />
              ) : (
                <div className="h-[104px] w-[104px] rounded-full border-[5px] border-white shadow-lg bg-primary text-on-primary flex items-center justify-center font-h3 text-[32px]">
                  {data.initials}
                </div>
              )}
              <div className="absolute inset-[5px] flex items-center justify-center gap-2 rounded-full bg-primary/75 opacity-100 backdrop-blur-[2px] transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {data.avatarUrl && (
                  <button type="button" onClick={() => setViewingAvatar(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md hover:bg-secondary-fixed" aria-label="View full profile image" title="View image">
                    <span className="material-symbols-outlined text-[19px]">visibility</span>
                  </button>
                )}
                <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-secondary-container text-on-primary shadow-md hover:brightness-105" aria-label="Change profile image" title="Change image">
                  <span className={`material-symbols-outlined text-[19px] ${uploadingAvatar ? 'animate-spin' : ''}`}>{uploadingAvatar ? 'progress_activity' : 'edit'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingAvatar} onChange={(event) => event.target.files?.[0] && changeAvatar(event.target.files[0])} className="sr-only" />
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between mb-3 px-1 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/contributions"
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3.5 py-2 text-secondary font-label-bold text-[11px] tracking-[0.08em] uppercase shadow-[0_2px_8px_rgba(0,31,80,0.06)] hover:border-secondary-container/50 hover:bg-secondary-container/10 transition-all"
              >
                <span className="material-symbols-outlined text-[17px]">payments</span>
                Contributions
              </Link>
              <Link
                href="/dashboard/member/family"
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3.5 py-2 text-secondary font-label-bold text-[11px] tracking-[0.08em] uppercase shadow-[0_2px_8px_rgba(0,31,80,0.06)] hover:border-secondary-container/50 hover:bg-secondary-container/10 transition-all"
              >
                <span className="material-symbols-outlined text-[17px]">family_restroom</span>
                My Family
              </Link>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v)
                setError('')
                setFullName(data.fullName)
                setPhone(data.phone ?? '')
                setLocation(data.location ?? '')
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container text-on-primary px-3.5 py-2 font-label-bold text-[11px] tracking-[0.08em] uppercase shadow-[0_4px_14px_rgba(254,128,21,0.35)] hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[17px]">edit</span>
              Edit
            </button>
          </div>

          <div className="text-center px-2">
            <h2 className="font-h2 text-[28px] leading-tight text-on-surface tracking-tight">
              {data.fullName}
            </h2>
            <p className="mt-1 text-[14px] text-on-surface-variant">{locationLine}</p>
            <p className="mt-1 text-[13px] text-on-surface-variant/75">
              {data.email}
              {data.phone ? ` · ${data.phone}` : ''}
            </p>
            {(data.memberId || data.familyTag) && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {data.memberId && (
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[12px] text-primary">
                    Member ID <b className="font-mono">{data.memberId}</b>
                  </span>
                )}
                {data.familyTag && (
                  <span className="rounded-lg bg-secondary-container/15 px-2.5 py-1 text-[12px] text-secondary">
                    Family tag <b className="font-mono">{data.familyTag}</b>
                  </span>
                )}
              </div>
            )}
          </div>

          {!editing && error && (
            <p className="mt-3 text-center text-[12px] text-error" role="alert">{error}</p>
          )}

          {editing && (
            <form
              onSubmit={onSave}
              className="mt-5 space-y-3 border-t border-outline-variant/40 pt-4"
            >
              {(
                [
                  ['Username', fullName, setFullName, true],
                  ['Phone', phone, setPhone, false],
                  ['Location', location, setLocation, false],
                ] as const
              ).map(([label, value, setter, required]) => (
                <div key={label}>
                  <label className="text-[12px] font-label-bold text-on-surface-variant">
                    {label}
                  </label>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    required={required}
                    className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-container/40 focus:border-secondary-container"
                  />
                </div>
              ))}
              {error && <p className="text-error text-[12px] text-center">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 border border-primary/80 text-primary rounded-full py-3 text-sm font-label-bold hover:bg-primary/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-secondary-container text-on-primary rounded-full py-3 text-sm font-label-bold disabled:opacity-60 shadow-[0_4px_14px_rgba(254,128,21,0.35)] hover:opacity-95"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-outline-variant/40 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[22px] font-h3 font-bold text-on-surface leading-none">
                {data.contributionCount}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant font-label-bold">
                Contributions
              </p>
            </div>
            <div>
              <p className="text-[22px] font-h3 font-bold text-secondary-container leading-none">
                {Math.round(data.contributionTotal).toLocaleString()}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-wider text-secondary font-label-bold">
                KES total
              </p>
            </div>
            <div>
              <p className="text-[22px] font-h3 font-bold text-on-surface leading-none">
                {data.welfareCount}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant font-label-bold">
                Welfare
              </p>
            </div>
          </div>
        </div>
      </section>

      {viewingAvatar && data.avatarUrl && createPortal(
        <div className="fixed inset-0 z-[300] flex h-[100dvh] w-screen items-center justify-center bg-primary/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Profile image preview" onClick={() => setViewingAvatar(false)}>
          <button type="button" onClick={() => setViewingAvatar(false)} className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-lg" aria-label="Close image preview">
            <span className="material-symbols-outlined">close</span>
          </button>
          <img src={data.avatarUrl} alt={`${data.fullName}'s profile`} className="max-h-[85vh] max-w-[92vw] rounded-3xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
        </div>,
        document.body,
      )}

      <section className="bg-surface-container-lowest rounded-2xl shadow-[0_8px_24px_rgba(0,31,80,0.08)] px-4 py-3.5 flex items-center gap-3 border border-outline-variant/60">
        <div className="h-11 w-11 rounded-full bg-secondary-fixed flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-secondary text-[22px] icon-fill">
            verified
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary">
            Membership
          </p>
          <p className="text-[12px] text-on-surface-variant truncate">
            {ROLE_LABEL[data.role]}
            {data.isSuperAdmin ? ' · Super Admin' : ''} · {data.status}
            {data.contributionTotal > 0
              ? ` · KES ${Math.round(data.contributionTotal).toLocaleString()} contributed`
              : ''}
          </p>
        </div>
      </section>
    </div>
  )
}
