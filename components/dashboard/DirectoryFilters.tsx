'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'

export const MEMBER_TYPES = ['Principal', 'Attached', 'Minor'] as const
export const ACCOUNT_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE', 'RESIGNED', 'DECEASED', 'DISQUALIFIED'] as const

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

const SELECT =
  'h-10 rounded-full border border-outline-variant bg-surface-container-lowest px-3 text-[12px] font-label-bold text-on-surface shadow-[0_2px_8px_rgba(0,31,80,0.06)] focus:border-secondary-container focus:outline-none'

/** Members-page filters, one dropdown each, kept in the URL so the table and header stay in sync. */
export default function DirectoryFilters({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function set(key: 'type' | 'role' | 'status', value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <>
      <select aria-label="Filter by member type" value={params.get('type') ?? ''} onChange={(e) => set('type', e.target.value)} className={SELECT}>
        <option value="">All members</option>
        <option value="Principal">Principal members</option>
        <option value="Attached">Attached members</option>
        <option value="Minor">Minors</option>
      </select>
      <select aria-label="Filter by role" value={params.get('role') ?? ''} onChange={(e) => set('role', e.target.value)} className={SELECT}>
        <option value="">All roles</option>
        {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
          <option key={role} value={role}>{ROLE_LABEL[role]}</option>
        ))}
        {isAdmin && <option value="SUPER_ADMIN">Super Administrator</option>}
      </select>
      {isAdmin && (
        <select aria-label="Filter by account status" value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)} className={SELECT}>
          <option value="">All accounts</option>
          {ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>{title(status)}</option>
          ))}
        </select>
      )}
    </>
  )
}
