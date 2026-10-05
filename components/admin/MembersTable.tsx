'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setContributionRights, setMemberStanding, setMemberStatus } from '@/app/actions/members'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'

function buildMembersHref(q: string, branch: string, role = '') {
  const params = new URLSearchParams()
  const trimmed = q.trim()
  if (trimmed) params.set('q', trimmed)
  if (branch) params.set('branch', branch)
  if (role) params.set('role', role)
  const qs = params.toString()
  return qs ? `/admin/accounts?${qs}` : '/admin/accounts'
}

export type RoleTab = { value: string; label: string; count: number }

export type MembersTableUser = {
  id: string
  fullName: string
  email: string
  role: Role
  status: string
  isSuperAdmin: boolean
  isPrincipal?: boolean
  principalName?: string | null
  phone: string | null
  location: string | null
  membershipNumber: string | null
  memberCategory: string | null
  familyBranch: string | null
  standing: 'PAID_UP' | 'LAPSED'
  standingReason: string | null
  standingOverride: 'PAID_UP' | 'LAPSED' | null
  standingOverrideUntil: string | null
  contributionExempt: boolean
  isMinor: boolean
}

type Props = {
  users: MembersTableUser[]
  branches?: string[]
  filters?: { q: string; branch: string; role?: string }
  roleTabs?: RoleTab[]
  pendingApprovals?: number
}

function statusStyles(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-primary/10 text-primary'
    case 'PENDING':
      return 'bg-secondary-fixed text-secondary'
    case 'SUSPENDED':
      return 'bg-error-container text-error'
    case 'INACTIVE':
      return 'bg-surface-container-high text-on-surface-variant'
    default:
      return 'bg-surface-container text-on-surface-variant'
  }
}

export default function MembersTable({
  users,
  filters = { q: '', branch: '' },
  roleTabs = [],
  pendingApprovals = 0,
}: Props) {
  const roleFilter = filters.role ?? ''
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [query, setQuery] = useState(filters.q)
  const [branchFilter, setBranchFilter] = useState(filters.branch)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setQuery(filters.q)
    setBranchFilter(filters.branch)
  }, [filters.q, filters.branch])

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  )

  useEffect(() => {
    if (!selected) return
    setError('')
    setOk('')
  }, [selected])

  const applyFilters = useCallback(
    (nextQ: string, nextBranch: string) => {
      const nextHref = buildMembersHref(nextQ, nextBranch, roleFilter)
      const currentHref = buildMembersHref(filters.q, filters.branch, roleFilter)
      if (nextHref === currentHref) return
      router.push(nextHref)
    },
    [filters.branch, filters.q, roleFilter, router],
  )

  const scheduleFilters = useCallback(
    (nextQ: string, nextBranch: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        applyFilters(nextQ, nextBranch)
      }, 300)
    },
    [applyFilters],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const flushFilters = useCallback(
    (nextQ = query, nextBranch = branchFilter) => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      applyFilters(nextQ, nextBranch)
    },
    [applyFilters, branchFilter, query],
  )

  const close = () => setSelectedId(null)
  const [standingUntil, setStandingUntil] = useState('')

  const applyStanding = (mode: 'AUTO' | 'PAID_UP' | 'LAPSED') => {
    if (!selected) return
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await setMemberStanding({ userId: selected.id, mode, until: mode === 'AUTO' ? undefined : standingUntil || undefined })
        setOk(mode === 'AUTO' ? 'Standing returned to automatic rules' : mode === 'PAID_UP' ? 'Marked paid-up' : 'Marked lapsed')
        setStandingUntil('')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update standing')
      }
    })
  }

  const applyContributionRights = (canContribute: boolean) => {
    if (!selected) return
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await setContributionRights({ userId: selected.id, canContribute })
        setOk(canContribute ? 'Contribution rights restored' : 'Contribution rights removed')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update contribution rights')
      }
    })
  }

  const setStatus = (status: 'ACTIVE' | 'SUSPENDED' | 'DECEASED' | 'RESIGNED' | 'DISQUALIFIED' | 'INACTIVE') => {
    if (!selected) return
    setError('')
    setOk('')
    startTransition(async () => {
      try {
        await setMemberStatus({ userId: selected.id, status })
        setOk(status === 'ACTIVE' ? 'Member restored' : 'Member suspended')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update status')
      }
    })
  }

  return (
    <div className="space-y-4 pb-8 px-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 xl:flex-nowrap">
        <div className="min-w-[220px] shrink-0">
          <h1 className="font-h2 text-[28px] leading-tight text-primary dark:text-primary-fixed-dim">Accounts</h1>
          <p className="text-xs text-on-surface-variant dark:text-blue-200/60">Super Administrator</p>
        </div>
        <form
          method="get"
          onSubmit={(event) => {
            event.preventDefault()
            flushFilters()
          }}
          className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 xl:flex-nowrap"
        >
        <div className="relative w-full sm:w-48 lg:w-52">
          <button type="submit" aria-label="Search members" title="Search" className="absolute left-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-outline transition hover:bg-primary hover:text-on-primary">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
          <input
            name="q"
            value={query}
            onChange={(event) => {
              const nextQ = event.target.value
              setQuery(nextQ)
              scheduleFilters(nextQ, branchFilter)
            }}
            placeholder="Search members…"
            className="h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-8 pr-2 text-xs focus:border-secondary-container focus:outline-none focus:ring-2 focus:ring-secondary-container/40"
          />
        </div>
          <Link
          href="/api/export/members"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-on-primary"
        >
          <span className="material-symbols-outlined text-[17px]">download</span>
          Export
          </Link>
          <Link
            href="/admin/approvals"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-secondary-container px-3 text-xs font-bold text-white"
          >
            <span className="material-symbols-outlined text-[17px]">pending_actions</span>
            Approvals
            {pendingApprovals > 0 && (
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] leading-none text-secondary">{pendingApprovals}</span>
            )}
          </Link>
        </form>
      </div>

      {roleTabs.length > 0 && (
        <nav aria-label="Filter accounts by role" className="flex flex-wrap gap-2">
          {roleTabs.map((tab) => {
            const active = tab.value === roleFilter
            return (
              <Link
                key={tab.value || 'all'}
                href={buildMembersHref(filters.q, filters.branch, tab.value)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/40 hover:text-primary'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 text-[10px] leading-4 ${active ? 'bg-white/20' : 'bg-surface-container-high'}`}>{tab.count}</span>
              </Link>
            )
          })}
        </nav>
      )}

      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left bg-surface-container-low border-b border-outline-variant">
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Name
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Email
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Role
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Principal
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Status
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Standing
                </th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant text-right w-16">
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-on-surface-variant">
                    No accounts found
                  </td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`border-t border-outline-variant/50 hover:bg-primary/[0.03] transition-colors ${
                      i % 2 === 1 ? 'bg-surface-container-low/40' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-on-surface">{u.fullName}</p>
                      {u.isSuperAdmin && (
                        <span className="text-[10px] uppercase tracking-wide text-secondary font-label-bold">
                          Super Admin
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">{u.email}</td>
                    <td className="py-3.5 px-4 text-on-surface">{ROLE_LABEL[u.role]}</td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {u.isPrincipal ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-label-bold uppercase tracking-wide bg-primary/10 text-primary">
                          Principal
                        </span>
                      ) : (
                        u.principalName || '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-label-bold uppercase tracking-wide ${statusStyles(u.status)}`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        title={u.standingReason || undefined}
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-label-bold uppercase tracking-wide ${u.standing === 'PAID_UP' ? 'bg-green-100 text-green-800' : 'bg-error-container text-error'}`}
                      >
                        {u.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'}
                      </span>
                      {u.standingReason && u.standing === 'LAPSED' && (
                        <p className="mt-1 max-w-[180px] truncate text-[11px] text-on-surface-variant">{u.standingReason}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(u.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-primary hover:border-secondary-container hover:bg-secondary-container/10 hover:text-secondary transition-colors"
                        title="View details"
                        aria-label={`View ${u.fullName}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mounted &&
        selected &&
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
              onClick={close}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)] overflow-hidden max-h-[min(90vh,560px)] flex flex-col">
              <div className="relative bg-primary px-5 py-4 shrink-0">
                <div className="absolute bottom-0 inset-x-0 h-1 bg-secondary-container" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-h3 text-[18px] text-on-primary truncate">
                      {selected.fullName}
                    </h3>
                    <p className="text-[12px] text-primary-fixed-dim mt-0.5 truncate">
                      {selected.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-primary shrink-0"
                  >
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <DetailChip label="Role" value={ROLE_LABEL[selected.role]} />
                  <DetailChip label="Status" value={selected.status} />
                  <DetailChip label="Phone" value={selected.phone?.trim() || '—'} />
                  <DetailChip label="Location" value={selected.location?.trim() || '—'} />
                  <DetailChip
                    label="Principal"
                    value={selected.isPrincipal ? 'Yes (this member)' : selected.principalName || 'Unassigned'}
                  />
                </div>

                {selected.isSuperAdmin && (
                  <p className="text-[12px] font-label-bold uppercase tracking-wide text-secondary">
                    Super Admin account
                  </p>
                )}

                <p className="text-xs text-on-surface-variant">
                  Role and dashboard access are managed on the Roles page.
                </p>
                <section className="space-y-2 border-t border-outline-variant pt-3">
                  <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary">Membership standing</p>
                  <p className="text-sm">
                    <b>{selected.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'}</b>
                    {selected.standingReason ? ` — ${selected.standingReason}` : ''}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {selected.standingOverride
                      ? `Manual setting${selected.standingOverrideUntil ? ` until ${new Date(selected.standingOverrideUntil).toLocaleDateString()}` : ' (no end date)'}.`
                      : 'Automatic — follows payments and the rules in Admin Finance.'}
                  </p>
                  <label className="block text-[11px] font-semibold text-on-surface-variant">
                    Until (optional — leave empty for no end date)
                    <input type="date" value={standingUntil} onChange={(e) => setStandingUntil(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" disabled={pending} onClick={() => applyStanding('PAID_UP')} className="h-9 rounded-lg bg-primary text-[11px] font-semibold text-on-primary disabled:opacity-50">Mark paid-up</button>
                    <button type="button" disabled={pending} onClick={() => applyStanding('LAPSED')} className="h-9 rounded-lg border border-error/40 text-[11px] font-semibold text-error disabled:opacity-50">Mark lapsed</button>
                    <button type="button" disabled={pending || !selected.standingOverride} onClick={() => applyStanding('AUTO')} className="h-9 rounded-lg border border-outline-variant text-[11px] font-semibold disabled:opacity-40">Automatic</button>
                  </div>
                  <label className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">Contribution rights</span>
                      <span className="block text-[11px] text-on-surface-variant">
                        {selected.isMinor
                          ? 'Under 18 — follows their Principal’s standing.'
                          : selected.contributionExempt
                            ? 'Removed — follows their Principal’s standing.'
                            : 'Pays their own dues — not affected by their Principal.'}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!selected.contributionExempt}
                      disabled={pending}
                      onChange={(e) => applyContributionRights(e.target.checked)}
                    />
                  </label>
                </section>
                <section className="pt-1 border-t border-outline-variant">
                  <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary mb-2">
                    Account actions
                  </p>
                  {selected.status === 'SUSPENDED' || selected.status === 'INACTIVE' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setStatus('ACTIVE')}
                      className="w-full h-11 rounded-full border-2 border-primary text-primary font-label-bold text-sm hover:bg-primary/5 disabled:opacity-50"
                    >
                      Restore member
                    </button>
                  ) : selected.status === 'ACTIVE' ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={pending || selected.isSuperAdmin}
                        onClick={() => setStatus('SUSPENDED')}
                        className="w-full h-11 rounded-full border border-error/40 text-error font-label-bold text-sm hover:bg-error-container/40 disabled:opacity-40"
                      >
                        Suspend member
                      </button>
                      <div className="grid grid-cols-3 gap-2">
                        {(['RESIGNED', 'DECEASED', 'DISQUALIFIED'] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={pending || selected.isSuperAdmin}
                            onClick={() => setStatus(status)}
                            className="h-9 rounded-lg border border-outline-variant text-[11px] font-semibold text-on-surface-variant hover:border-primary/40 disabled:opacity-40"
                          >
                            {status === 'RESIGNED' ? 'Resigned' : status === 'DECEASED' ? 'Deceased' : 'Disqualified'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      Status actions apply to ACTIVE / SUSPENDED / INACTIVE members.
                    </p>
                  )}
                </section>

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
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide font-label-bold text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-on-surface truncate">{value}</p>
    </div>
  )
}
