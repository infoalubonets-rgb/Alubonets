'use client'

import { useTransition } from 'react'
import { setDisabledRoles } from '@/app/actions/settings'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/lib/auth/types'

export default function RoleCatalogueForm({ disabledRoles }: { disabledRoles: Role[] }) {
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="rounded-2xl border border-outline-variant bg-surface p-5 space-y-3"
      action={(formData) => {
        startTransition(async () => {
          await setDisabledRoles(formData)
        })
      }}
    >
      <div>
        <h2 className="font-bold text-on-surface">Role catalogue</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Deactivate a role to hide it from assignment. Admin cannot be deactivated. Existing holders keep the role until reassigned.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {ALL_ROLES.map((role) => {
          const locked = role === 'ADMIN'
          const disabled = disabledRoles.includes(role)
          return (
            <li key={role}>
              <label className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${locked ? 'opacity-70' : ''}`}>
                <input
                  type="checkbox"
                  name="disabledRoles"
                  value={role}
                  defaultChecked={disabled}
                  disabled={locked || pending}
                />
                <span className="text-sm font-medium text-on-surface">
                  {ROLE_LABEL[role]}
                  {locked ? ' — always active' : disabled ? ' — deactivated' : ' — active'}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save catalogue'}
      </button>
    </form>
  )
}
