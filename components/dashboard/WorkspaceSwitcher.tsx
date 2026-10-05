'use client'

import { allowedDashboards, ROLE_HOME, ROLE_LABEL, roleForDashboardPath, type AuthUser, type Role } from '@/lib/auth/types'
import { usePathname, useRouter } from 'next/navigation'

type Props = {
  user: AuthUser
}

export default function WorkspaceSwitcher({ user }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const workspaces = allowedDashboards({
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    dashboardAccess: user.dashboardAccess ?? [],
  })

  if (workspaces.length <= 1) return null

  const currentRole = roleForDashboardPath(pathname) ?? user.role

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-label-bold hidden sm:inline">
        Workspace
      </span>
      <select
        aria-label="Switch workspace"
        className="bg-transparent text-[12px] font-label-bold text-on-surface dark:text-blue-50 focus:outline-none max-w-[140px]"
        value={currentRole}
        onChange={(e) => {
          const role = e.target.value as Role
          router.push(ROLE_HOME[role])
        }}
      >
        {workspaces.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
            {user.disabledRoles?.includes(role) ? ' (deactivated)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
