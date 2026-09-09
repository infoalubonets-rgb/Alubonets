'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDirectoryFullAccessRoles } from '@/app/actions/settings'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/lib/auth/types'

const OPTIONAL_ROLES = ALL_ROLES.filter((role) => role !== 'ADMIN' && role !== 'MEMBER')

export default function DirectoryFullAccessForm({
  selectedRoles,
}: {
  selectedRoles: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [roles, setRoles] = useState<string[]>(selectedRoles)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage('')
        setError('')
        const formData = new FormData()
        roles.forEach((role) => formData.append('roles', role))
        startTransition(async () => {
          try {
            await updateDirectoryFullAccessRoles(formData)
            setMessage('Directory full-list access updated.')
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save.')
          }
        })
      }}
    >
      <p className="text-xs text-on-surface-variant">
        Admin and Super Admin always see every active member. Children under 18 stay hidden from the
        member directory unless listed here. Tick extra roles that may see the full member list.
      </p>
      <fieldset className="grid gap-2">
        {OPTIONAL_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={(event) => {
                setRoles((prev) =>
                  event.target.checked ? [...prev, role] : prev.filter((value) => value !== role),
                )
              }}
            />
            {ROLE_LABEL[role as Role]}
          </label>
        ))}
      </fieldset>
      <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50">
        Save directory access
      </button>
      {message && <p className="text-sm text-primary">{message}</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  )
}
