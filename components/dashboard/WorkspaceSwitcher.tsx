'use client'

import { allowedDashboards, ROLE_HOME, ROLE_LABEL, roleForDashboardPath, type AuthUser, type Role } from '@/lib/auth/types'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'

const SUPER_ADMIN_OPTION = 'SUPER_ADMIN'

type Props = {
  user: AuthUser
}

export default function WorkspaceSwitcher({ user }: Props) {
  const pathname = usePathname()
  const workspaces = allowedDashboards({
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    dashboardAccess: user.dashboardAccess ?? [],
  })

  const [switching, startSwitch] = useTransition()
  const [error, setError] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  if (workspaces.length <= 1) return null

  const pathRole = user.activeWorkspace ?? roleForDashboardPath(pathname) ?? user.role
  // The selected mode controls both the label and server permissions.
  const currentRole = pathRole === 'ADMIN' && user.isSuperAdmin ? (user.activeSuperAdmin ? SUPER_ADMIN_OPTION : 'ADMIN') : pathRole
  const options: string[] = user.isSuperAdmin
    ? workspaces.flatMap((role) => (role === 'ADMIN' ? [SUPER_ADMIN_OPTION, 'ADMIN'] : [role]))
    : workspaces

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-label-bold hidden sm:inline">
        Workspace
      </span>
      <select
        aria-label="Switch workspace"
        disabled={switching}
        className="bg-transparent text-[12px] font-label-bold text-on-surface dark:text-blue-50 focus:outline-none max-w-[140px] disabled:opacity-60"
        value={switching && target ? target : currentRole}
        onChange={(e) => {
          const value = e.target.value
          const go = (href: string) => {
            setTarget(value)
            setError('')
            startSwitch(async () => {
              try {
                const response = await fetch('/api/auth/workspace', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: value }),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Could not switch workspace.')
                window.location.assign(href)
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Could not switch workspace.')
                setTarget(null)
              }
            })
          }
          if (value === SUPER_ADMIN_OPTION || (value === 'ADMIN' && user.isSuperAdmin)) {
            go(ROLE_HOME.ADMIN)
            return
          }
          go(ROLE_HOME[value as Role])
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === SUPER_ADMIN_OPTION ? 'Super Administrator' : ROLE_LABEL[option as Role]}
            {user.disabledRoles?.includes(option as Role) ? ' (deactivated)' : ''}
          </option>
        ))}
      </select>
      {error && <span role="alert" className="max-w-[220px] text-xs text-error">{error}</span>}
      {switching && (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-secondary" role="status">
          <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
          Opening…
        </span>
      )}
    </div>
  )
}
