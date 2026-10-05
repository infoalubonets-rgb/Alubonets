'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { setRoleActive } from '@/app/actions/settings'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/lib/auth/types'

function RoleToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fe8015] disabled:opacity-60 ${
        checked ? 'bg-[#fe8015]' : 'bg-outline-variant'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function RoleCatalogueSettings({
  disabledRoles,
  holderCounts,
  defaultOpen = false,
}: {
  disabledRoles: Role[]
  holderCounts: Partial<Record<Role, number>>
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [disabled, setDisabled] = useState<Role[]>(disabledRoles)
  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()

  function toggle(role: Role, active: boolean) {
    const holders = holderCounts[role] ?? 0
    if (
      !active &&
      holders > 0 &&
      !window.confirm(
        `${holders} ${holders === 1 ? 'person has' : 'people have'} the ${ROLE_LABEL[role]} role. They will be signed out and unable to log in until the role is turned back on. Continue?`,
      )
    ) {
      return
    }
    const previous = disabled
    setDisabled(active ? previous.filter((r) => r !== role) : [...previous, role])
    setError('')
    setPendingRole(role)
    startTransition(async () => {
      try {
        const result = await setRoleActive(role, active)
        setDisabled(result.disabledRoles as Role[])
        router.refresh()
      } catch (e) {
        setDisabled(previous)
        setError(e instanceof Error ? e.message : 'Could not update that role. Try again.')
      } finally {
        setPendingRole(null)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 text-[12px] font-label-bold text-on-surface-variant shadow-sm transition hover:bg-surface-container hover:text-primary active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">toggle_on</span>
        Turn roles on/off
      </button>

      <FullScreenModal open={open} title="Role settings" onClose={() => setOpen(false)} size="compact">
        <div className="mx-auto w-full max-w-xl space-y-4">
          <ul className="divide-y divide-outline-variant/60 rounded-2xl border border-outline-variant">
            {ALL_ROLES.map((role) => {
              const locked = role === 'ADMIN'
              const active = locked || !disabled.includes(role)
              const holders = holderCounts[role] ?? 0
              return (
                <li key={role} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">{ROLE_LABEL[role]}</p>
                    <p className="text-xs text-on-surface-variant">
                      {locked ? 'Always active' : active ? 'Active' : 'Inactive — holders cannot sign in'}
                      {' · '}
                      {holders} {holders === 1 ? 'person' : 'people'}
                    </p>
                  </div>
                  <RoleToggle
                    label={`${ROLE_LABEL[role]} role active`}
                    checked={active}
                    disabled={locked || pendingRole !== null}
                    onChange={(next) => toggle(role, next)}
                  />
                </li>
              )
            })}
          </ul>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      </FullScreenModal>
    </>
  )
}
