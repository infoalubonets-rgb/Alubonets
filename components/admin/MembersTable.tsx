'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { assignMemberBranch, createBranchLineage, setMemberStatus } from '@/app/actions/members'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'

function buildMembersHref(q: string, branch: string) {
  const params = new URLSearchParams()
  const trimmed = q.trim()
  if (trimmed) params.set('q', trimmed)
  if (branch) params.set('branch', branch)
  const qs = params.toString()
  return qs ? `/admin/members?${qs}` : '/admin/members'
}

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
}

type Props = {
  users: MembersTableUser[]
  branches?: string[]
  filters?: { q: string; branch: string }
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
  branches = [],
  filters = { q: '', branch: '' },
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [query, setQuery] = useState(filters.q)
  const [branchFilter, setBranchFilter] = useState(filters.branch)
  const [newBranch, setNewBranch] = useState('')
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
      const nextHref = buildMembersHref(nextQ, nextBranch)
      const currentHref = buildMembersHref(filters.q, filters.branch)
      if (nextHref === currentHref) return
      router.push(nextHref)
    },
    [filters.branch, filters.q, router],
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

  const setStatus = (status: 'ACTIVE' | 'SUSPENDED') => {
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
          <h1 className="font-h2 text-[28px] leading-tight text-primary dark:text-primary-fixed-dim">Member registry</h1>
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
        <select
          name="branch"
          value={branchFilter}
          onChange={(event) => {
            const nextBranch = event.target.value
            setBranchFilter(nextBranch)
            flushFilters(query, nextBranch)
          }}
          aria-label="Branch or lineage"
          className="h-9 w-[150px] rounded-xl border border-outline-variant bg-surface-container-lowest px-2 text-xs"
        >
          <option value="">All branches / lineages</option>
          {branches.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
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
        </form>
      </div>

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
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant text-right w-16">
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-on-surface-variant">
                    No members found
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
                  <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary">Branch / lineage</p>
                  <form action={async (formData) => { await assignMemberBranch(selected.id, String(formData.get('branch') || 'Default')); router.refresh() }} className="flex gap-2">
                    <select name="branch" defaultValue={selected.familyBranch || 'Default'} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm">{branches.map((branch) => <option key={branch}>{branch}</option>)}</select>
                    <button className="rounded-lg bg-primary px-3 text-sm text-on-primary">Assign</button>
                  </form>
                  <form action={async () => { if (!newBranch.trim()) return; await createBranchLineage(newBranch); setNewBranch(''); router.refresh() }} className="flex gap-2">
                    <input value={newBranch} onChange={(event) => setNewBranch(event.target.value)} placeholder="New branch / lineage" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
                    <button className="rounded-lg border px-3 text-sm">Add</button>
                  </form>
                </section>
                <section className="pt-1 border-t border-outline-variant">
                  <p className="font-label-bold text-[12px] uppercase tracking-wide text-secondary mb-2">
                    Account actions
                  </p>
                  {selected.status === 'SUSPENDED' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setStatus('ACTIVE')}
                      className="w-full h-11 rounded-full border-2 border-primary text-primary font-label-bold text-sm hover:bg-primary/5 disabled:opacity-50"
                    >
                      Restore member
                    </button>
                  ) : selected.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      disabled={pending || selected.isSuperAdmin}
                      onClick={() => setStatus('SUSPENDED')}
                      className="w-full h-11 rounded-full border border-error/40 text-error font-label-bold text-sm hover:bg-error-container/40 disabled:opacity-40"
                    >
                      Suspend member
                    </button>
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      Status actions apply to ACTIVE / SUSPENDED members only.
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
