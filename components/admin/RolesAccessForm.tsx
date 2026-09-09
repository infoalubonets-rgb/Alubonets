'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  setMemberDashboardAccess,
  setMemberRole,
  setSuperAdminFlag,
} from '@/app/actions/members'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/lib/auth/types'

export type RolesUser = {
  id: string
  fullName: string
  email: string
  role: Role
  isSuperAdmin: boolean
  dashboardAccess: Role[]
}

type Props = {
  users: RolesUser[]
  actorIsSuperAdmin: boolean
  actorId: string
}

type ModalKind = 'account' | 'role' | 'access' | null

const ROLE_ICON: Record<Role, string> = {
  ADMIN: 'admin_panel_settings',
  EXECUTIVE: 'groups',
  TREASURER: 'account_balance',
  SECRETARY: 'description',
  ORGANIZER: 'event',
  MEMBER: 'person',
  AUDITOR: 'policy',
}

export default function RolesAccessForm({ users, actorIsSuperAdmin }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modal, setModal] = useState<ModalKind>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [access, setAccess] = useState<Role[]>([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [query, setQuery] = useState('')

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId]
  )

  useEffect(() => {
    if (!selected) return
    setRole(selected.role)
    const extras = Array.isArray(selected.dashboardAccess) ? selected.dashboardAccess : []
    setAccess(Array.from(new Set<Role>([selected.role, ...extras])))
  }, [selected])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, query])

  const accessCount = useMemo(() => {
    if (!role) return 0
    return Array.from(new Set([role, ...access])).length
  }, [role, access])

  const closeModal = () => {
    setModal(null)
    setQuery('')
  }

  const pickUser = (u: RolesUser) => {
    setSelectedId(u.id)
    setRole(u.role)
    const extras = Array.isArray(u.dashboardAccess) ? u.dashboardAccess : []
    setAccess(Array.from(new Set<Role>([u.role, ...extras])))
    setError('')
    setOk('')
    closeModal()
  }

  const pickRole = (r: Role) => {
    if (r === 'ADMIN' && !actorIsSuperAdmin) {
      setError('Only a Super Admin can assign the Admin role')
      return
    }
    setRole(r)
    setAccess((prev) => Array.from(new Set<Role>([r, ...prev])))
    setError('')
    closeModal()
  }

  const toggleAccess = (r: Role) => {
    if (!role || r === role) return
    setAccess((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  const save = () => {
    if (!selected || !role) {
      setError('Select an account and a role first')
      return
    }
    if (selected.isSuperAdmin) {
      setError('Super Admin accounts cannot be changed by other members')
      return
    }
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        if (role !== selected.role) {
          await setMemberRole({ userId: selected.id, role })
        }
        await setMemberDashboardAccess({
          userId: selected.id,
          dashboardAccess: access,
        })
        setOk('Access updated')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }

  const toggleSuper = () => {
    if (!selected || !actorIsSuperAdmin) return
    // Existing Super Admins cannot be revoked — only grant to others.
    if (selected.isSuperAdmin) {
      setError('Super Admin cannot be removed by any other member')
      return
    }
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await setSuperAdminFlag({
          userId: selected.id,
          isSuperAdmin: true,
        })
        setOk('Super Admin granted')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update Super Admin')
      }
    })
  }

  const accountSummary = selected
    ? selected.fullName.split(' ')[0]
    : 'Choose member'
  const roleSummary = role ? ROLE_LABEL[role] : 'Choose role'
  const accessSummary = role
    ? `${accessCount} dashboard${accessCount === 1 ? '' : 's'}`
    : 'Choose access'

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm font-medium text-on-surface">
          Tap the three bubbles from left to right to update a member.
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Choose the account, set their primary role, then select the dashboards they can access.
        </p>
      </div>

      {/* Three bubbles side by side */}
      <div className="flex items-start justify-center gap-4 sm:gap-10 px-2 pt-2">
        <SelectorBubble
          label="Account"
          summary={accountSummary}
          description="Select the member"
          icon="account_circle"
          filled={!!selected}
          open={modal === 'account'}
          onClick={() => setModal('account')}
        />
        <SelectorBubble
          label="Role"
          summary={roleSummary}
          description="Set their main role"
          icon="badge"
          filled={!!role}
          open={modal === 'role'}
          disabled={!selected || selected.isSuperAdmin}
          onClick={() => selected && !selected.isSuperAdmin && setModal('role')}
        />
        <SelectorBubble
          label="Access"
          summary={selected?.isSuperAdmin ? 'All dashboards' : accessSummary}
          description="Choose dashboards"
          icon="dashboard"
          filled={!!role && accessCount > 0}
          open={modal === 'access'}
          disabled={!selected || !role || selected.isSuperAdmin}
          onClick={() => selected && role && !selected.isSuperAdmin && setModal('access')}
        />
      </div>

      {selected && actorIsSuperAdmin && (
        <div className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-[0_4px_12px_rgba(20,32,51,0.05)]">
          <div>
            <p className="font-label-bold text-sm text-on-surface">Super Admin</p>
            <p className="text-[11px] text-on-surface-variant">
              {selected.isSuperAdmin
                ? 'Highest authority — cannot be removed by other members'
                : 'Grant full access across every workspace'}
            </p>
          </div>
          <button
            type="button"
            disabled={pending || selected.isSuperAdmin}
            onClick={toggleSuper}
            title={selected.isSuperAdmin ? 'Super Admin cannot be removed' : 'Grant Super Admin'}
            className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
              selected.isSuperAdmin ? 'bg-secondary-container' : 'bg-outline-variant'
            }`}
            aria-pressed={selected.isSuperAdmin}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                selected.isSuperAdmin ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-error text-center bg-error-container/40 rounded-xl py-2 px-3">
          {error}
        </p>
      )}
      {ok && !error && (
        <p className="text-sm text-primary text-center bg-primary-fixed/50 rounded-xl py-2 px-3">
          {ok}
        </p>
      )}

      <button
        type="button"
        disabled={!selected || !role || pending || selected.isSuperAdmin}
        onClick={save}
        className="w-full h-12 rounded-full bg-secondary-container text-on-primary font-label-bold text-[15px] hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-45 disabled:cursor-not-allowed shadow-md"
      >
        {pending ? 'Saving…' : selected?.isSuperAdmin ? 'Protected Super Admin' : 'Save changes'}
      </button>

      {/* Portal so overlay covers sidebar + top nav (not clipped by main overflow) */}
      {mounted &&
        modal &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute inset-0 bg-primary/55 backdrop-blur-sm"
              aria-label="Close"
              onClick={closeModal}
            />
            <div className="relative w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)] overflow-hidden">
              <div className="relative bg-primary px-5 py-4">
                <div className="absolute bottom-0 inset-x-0 h-1 bg-secondary-container" />
                <div className="relative flex items-center justify-between">
                  <h3 className="font-h3 text-[18px] text-on-primary">
                    {modal === 'account' && 'Select account'}
                    {modal === 'role' && 'Select role'}
                    {modal === 'access' && 'Dashboard access'}
                  </h3>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-primary"
                  >
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              {modal === 'account' && (
                <>
                  <div className="px-4 pt-3">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                        search
                      </span>
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-outline-variant bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary-container/40 focus:border-secondary-container"
                      />
                    </div>
                  </div>
                  <ul className="max-h-[min(52vh,380px)] overflow-y-auto py-2">
                    {filteredUsers.length === 0 ? (
                      <li className="px-5 py-6 text-sm text-on-surface-variant text-center">
                        No members found
                      </li>
                    ) : (
                      filteredUsers.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => pickUser(u)}
                            className={`w-full text-left px-5 py-3 hover:bg-secondary-container/10 transition-colors flex items-center justify-between gap-3 ${
                              selectedId === u.id ? 'bg-secondary-container/15' : ''
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-[15px] text-on-surface truncate">
                                {u.fullName}
                              </span>
                              <span className="block text-[12px] text-on-surface-variant truncate mt-0.5">
                                {u.email}
                              </span>
                            </span>
                            {selectedId === u.id && (
                              <span className="material-symbols-outlined text-secondary-container text-[20px] shrink-0">
                                check_circle
                              </span>
                            )}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}

              {modal === 'role' && (
                <ul className="max-h-[min(52vh,380px)] overflow-y-auto py-2">
                  {ALL_ROLES.map((r) => {
                    const blocked = r === 'ADMIN' && !actorIsSuperAdmin
                    return (
                      <li key={r}>
                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => !blocked && pickRole(r)}
                          className={`w-full text-left px-5 py-3.5 hover:bg-secondary-container/10 transition-colors flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed ${
                            role === r ? 'bg-secondary-container/15' : ''
                          }`}
                        >
                          <span
                            className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                              role === r
                                ? 'bg-secondary-container text-on-primary'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {ROLE_ICON[r]}
                            </span>
                          </span>
                          <span className="flex-1 font-medium text-[15px] text-on-surface">
                            {ROLE_LABEL[r]}
                          </span>
                          {role === r && (
                            <span className="material-symbols-outlined text-secondary-container text-[20px]">
                              check_circle
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {modal === 'access' && (
                <div className="p-4 space-y-2 max-h-[min(52vh,380px)] overflow-y-auto">
                  <p className="text-[11px] text-on-surface-variant px-1 pb-1">
                    Home role stays on. Tap others to grant or revoke extra dashboards.
                  </p>
                  {ALL_ROLES.map((r) => {
                    const checked = access.includes(r) || role === r
                    const locked = role === r
                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={locked}
                        onClick={() => toggleAccess(r)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 border transition-colors text-left disabled:cursor-default ${
                          checked
                            ? 'bg-secondary-container/12 border-secondary-container/40'
                            : 'bg-surface border-outline-variant hover:border-primary/30'
                        }`}
                      >
                        <span
                          className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-secondary-container text-on-primary'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {ROLE_ICON[r]}
                          </span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium text-[14px] text-on-surface">
                            {ROLE_LABEL[r]}
                          </span>
                          {locked && (
                            <span className="text-[10px] uppercase tracking-wide text-secondary font-label-bold">
                              Home · always on
                            </span>
                          )}
                        </span>
                        <span
                          className={`h-5 w-5 rounded-md border-2 flex items-center justify-center ${
                            checked
                              ? 'border-secondary-container bg-secondary-container text-on-primary'
                              : 'border-outline-variant'
                          }`}
                        >
                          {checked && (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full mt-2 h-11 rounded-full bg-secondary-container text-on-primary font-label-bold text-sm shadow-sm hover:opacity-95"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

function SelectorBubble({
  label,
  summary,
  description,
  icon,
  filled,
  open,
  disabled,
  onClick,
}: {
  label: string
  summary: string
  description: string
  icon: string
  filled: boolean
  open: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const active = open || filled

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group flex flex-col items-center gap-2.5 max-w-[112px] sm:max-w-[140px] disabled:opacity-40 disabled:cursor-not-allowed transition-transform ${
        open ? 'scale-105' : 'hover:scale-[1.03] active:scale-[0.98]'
      }`}
    >
      <span
        className={`relative flex h-[88px] w-[88px] sm:h-[104px] sm:w-[104px] items-center justify-center rounded-full transition-all duration-200 ${
          active
            ? 'bg-surface-container-lowest border-[3px] border-secondary-container shadow-[0_10px_28px_rgba(254,128,21,0.28)]'
            : 'bg-surface-container-lowest border-[2.5px] border-primary shadow-[0_6px_18px_rgba(0,31,80,0.12)]'
        }`}
      >
        {/* Inner core — asleep / awake feel */}
        <span
          className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full transition-colors ${
            open
              ? 'bg-secondary-container text-on-primary'
              : filled
                ? 'bg-secondary-container/20 text-secondary'
                : 'bg-primary/8 text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[28px] sm:text-[32px]">{icon}</span>
        </span>
        {open && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-secondary-container border-2 border-white" />
        )}
      </span>
      <span className="text-center space-y-0.5">
        <span
          className={`block font-label-bold text-[12px] uppercase tracking-[0.12em] ${
            active ? 'text-secondary' : 'text-primary'
          }`}
        >
          {label}
        </span>
        <span
          className={`block text-[12px] leading-snug truncate max-w-[112px] sm:max-w-[140px] ${
            filled ? 'text-on-surface font-medium' : 'text-on-surface-variant'
          }`}
        >
          {summary}
        </span>
        <span className="block pt-1 text-[10px] leading-snug text-on-surface-variant">
          {description}
        </span>
      </span>
    </button>
  )
}
