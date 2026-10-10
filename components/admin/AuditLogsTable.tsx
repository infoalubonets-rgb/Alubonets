'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatAuditAction, formatAuditMeta } from '@/lib/audit-labels'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'

export type AuditLogRow = {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  meta: unknown
  oldValue: unknown
  newValue: unknown
  reason: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: { fullName: string; email: string } | null
  targetKind: string
  targetLabel: string
  targetSubtitle: string | null
  /** Primary role when written; null for entries made before this was recorded. */
  actorRole: string | null
  /** Done outside the actor's primary role — shown in red. */
  outsideRole: boolean
  /** Extra dashboard access the actor held when this was written. */
  actorSecondaryRoles: string[]
  /** The role this change was made as. */
  actingRole: string | null
}

const roleName = (role: string | null) => (role ? ROLE_LABEL[role as Role] ?? role : 'Unknown role')

const PAGE_SIZE = 25

export default function AuditLogsTable({ logs }: { logs: AuditLogRow[] }) {
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((row) => {
      const label = formatAuditAction(row.action).toLowerCase()
      const meta = formatAuditMeta(row.meta)?.toLowerCase() ?? ''
      const reason = row.reason?.toLowerCase() ?? ''
      return (
        (row.user?.fullName ?? '').toLowerCase().includes(q) ||
        (row.user?.email ?? '').toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q) ||
        label.includes(q) ||
        row.targetKind.toLowerCase().includes(q) ||
        row.targetLabel.toLowerCase().includes(q) ||
        (row.targetSubtitle ?? '').toLowerCase().includes(q) ||
        reason.includes(q) ||
        meta.includes(q)
      )
    })
  }, [logs, query])

  const selected = useMemo(
    () => logs.find((r) => r.id === selectedId) ?? null,
    [logs, selectedId],
  )

  const slice = filtered.slice(0, visible)

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
            search
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisible(PAGE_SIZE)
            }}
            placeholder="Search actor, action, reason…"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2.5 pl-9 pr-3 text-sm focus:border-secondary-container focus:outline-none focus:ring-2 focus:ring-secondary-container/40"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-left">
                <th className="px-4 py-2.5 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  When
                </th>
                <th className="px-4 py-2.5 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Who
                </th>
                <th className="px-4 py-2.5 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  What
                </th>
                <th className="px-4 py-2.5 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  About
                </th>
                <th className="w-14 px-4 py-2.5 text-right font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-on-surface-variant">
                    No activity found
                  </td>
                </tr>
              ) : (
                slice.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-t border-outline-variant/50 ${
                      row.outsideRole
                        ? 'bg-red-50 text-red-900 shadow-[inset_4px_0_0_#dc2626] hover:bg-red-100 dark:bg-red-500/10 dark:text-red-100'
                        : `hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-on-surface-variant">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="max-w-[180px] px-4 py-2.5">
                      <p className={`truncate font-medium ${row.outsideRole ? 'text-red-800 dark:text-red-200' : 'text-on-surface'}`}>
                        {row.user?.fullName ?? 'System / removed user'}
                      </p>
                      {row.actorRole && !row.outsideRole && (
                        <p className="truncate text-[11px] text-on-surface-variant">{roleName(row.actorRole)}</p>
                      )}
                      {row.outsideRole && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Done through extra access, not their primary role">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          {roleName(row.actorRole)} → {roleName(row.actingRole)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-label-bold text-primary">
                        {formatAuditAction(row.action)}
                      </span>
                    </td>
                    <td className="min-w-0 px-4 py-2.5">
                      <p className="truncate font-medium text-on-surface">{row.targetLabel}</p>
                      <p className="truncate text-[11px] text-on-surface-variant">
                        {row.targetKind}
                        {row.targetSubtitle ? ` · ${row.targetSubtitle}` : ''}
                        {row.reason ? ` · ${row.reason}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-primary transition-colors hover:border-secondary-container hover:bg-secondary-container/10 hover:text-secondary"
                        title="View details"
                        aria-label="View log details"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {visible < filtered.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2.5 text-sm font-label-bold text-primary transition-colors hover:border-secondary-container hover:bg-secondary-container/10"
          >
            Load more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}

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
              onClick={() => setSelectedId(null)}
            />
            <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)]">
              <div className="relative bg-primary px-5 py-4">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-secondary-container" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-h3 text-[18px] text-on-primary">
                      {formatAuditAction(selected.action)}
                    </h3>
                    <p className="mt-0.5 text-[12px] text-primary-fixed-dim">
                      {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-primary hover:bg-white/10"
                  >
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <DetailBlock
                  label="Done by"
                  value={selected.user?.fullName ?? 'System / removed user'}
                  hint={selected.user?.email}
                />
                {selected.actorRole && (
                  <DetailBlock
                    label={selected.actingRole && selected.actingRole !== selected.actorRole ? 'Roles' : 'Role'}
                    value={selected.actingRole && selected.actingRole !== selected.actorRole
                      ? `Primary: ${roleName(selected.actorRole)} · Used: ${roleName(selected.actingRole)} (secondary)`
                      : roleName(selected.actorRole)}
                  />
                )}
                <DetailBlock
                  label="What changed"
                  value={formatAuditAction(selected.action)}
                  hint={selected.targetLabel && !selected.targetLabel.endsWith('(removed)') && selected.targetLabel !== '—'
                    ? [selected.targetLabel, selected.targetSubtitle].filter(Boolean).join(' · ')
                    : null}
                />
                {selected.reason && <DetailBlock label="Reason" value={selected.reason} />}

              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function DetailBlock({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string | null
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5">
      <p className="font-label-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-on-surface">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-on-surface-variant">{hint}</p> : null}
    </div>
  )
}
