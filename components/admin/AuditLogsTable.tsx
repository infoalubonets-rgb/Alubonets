'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatAuditAction, formatAuditMeta } from '@/lib/audit-labels'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'
import { deleteAuditRecord } from '@/app/actions/audit'

export type AuditLogRow = {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  meta: unknown
  createdAt: string
  user: { fullName: string; email: string }
  targetKind: string
  targetLabel: string
  targetSubtitle: string | null
}

const PAGE_SIZE = 25

function friendlyMetaLines(meta: unknown): { label: string; value: string }[] {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return []
  const m = meta as Record<string, unknown>
  const lines: { label: string; value: string }[] = []

  if (typeof m.role === 'string') {
    lines.push({
      label: 'New role',
      value: ROLE_LABEL[m.role as Role] ?? m.role,
    })
  }
  if (typeof m.status === 'string') {
    lines.push({ label: 'Status', value: m.status })
  }
  if (typeof m.isSuperAdmin === 'boolean') {
    lines.push({ label: 'Super Admin', value: m.isSuperAdmin ? 'Granted' : 'Revoked' })
  }
  if (Array.isArray(m.dashboardAccess)) {
    const roles = (m.dashboardAccess as string[])
      .map((r) => ROLE_LABEL[r as Role] ?? r)
      .join(', ')
    lines.push({
      label: 'Dashboards',
      value: roles || `${m.dashboardAccess.length} granted`,
    })
  }
  if (typeof m.created === 'number') {
    lines.push({ label: 'Rows imported', value: String(m.created) })
  }
  if (typeof m.amount === 'number') {
    lines.push({ label: 'Amount', value: `KES ${m.amount.toLocaleString()}` })
  }
  if (typeof m.checkoutRequestId === 'string') {
    lines.push({ label: 'Checkout request', value: m.checkoutRequestId })
  }
  if (typeof m.merchantRequestId === 'string') {
    lines.push({ label: 'Merchant request', value: m.merchantRequestId })
  }
  if (typeof m.targetUserId === 'string') {
    lines.push({ label: 'Payment for user ID', value: m.targetUserId })
  }
  if (typeof m.documentId === 'string') {
    lines.push({ label: 'Document', value: m.documentId })
  }
  if (typeof m.filename === 'string') {
    lines.push({ label: 'File', value: m.filename })
  }
  if (typeof m.storagePath === 'string') {
    lines.push({ label: 'Storage path', value: m.storagePath })
  }

  return lines
}

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
      return (
        row.user.fullName.toLowerCase().includes(q) ||
        row.user.email.toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q) ||
        label.includes(q) ||
        row.targetKind.toLowerCase().includes(q) ||
        row.targetLabel.toLowerCase().includes(q) ||
        (row.targetSubtitle ?? '').toLowerCase().includes(q) ||
        meta.includes(q)
      )
    })
  }, [logs, query])

  const selected = useMemo(
    () => logs.find((r) => r.id === selectedId) ?? null,
    [logs, selectedId]
  )

  const slice = filtered.slice(0, visible)

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-on-surface-variant max-w-xl">
          Who did what — tap the eye for full detail. Newest first.
        </p>
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisible(PAGE_SIZE)
            }}
            placeholder="Search actor, action, member…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary-container/40 focus:border-secondary-container"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left bg-surface-container-low border-b border-outline-variant">
                <th className="py-2.5 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  When
                </th>
                <th className="py-2.5 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  Who
                </th>
                <th className="py-2.5 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  What
                </th>
                <th className="py-2.5 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">
                  About
                </th>
                <th className="py-2.5 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant text-right w-14">
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
                    className={`border-t border-outline-variant/50 hover:bg-primary/[0.03] ${
                      i % 2 === 1 ? 'bg-surface-container-low/40' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap text-[12px] text-on-surface-variant">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-on-surface truncate max-w-[140px]">
                      {row.user.fullName}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-label-bold bg-primary/8 text-primary">
                        {formatAuditAction(row.action)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 min-w-0">
                      <p className="font-medium text-on-surface truncate">{row.targetLabel}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">
                        {row.targetKind}
                        {row.targetSubtitle ? ` · ${row.targetSubtitle}` : ''}
                      </p>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-primary hover:border-secondary-container hover:bg-secondary-container/10 hover:text-secondary transition-colors"
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
            className="rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2.5 text-sm font-label-bold text-primary hover:border-secondary-container hover:bg-secondary-container/10 transition-colors"
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
            <div className="relative w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)] overflow-hidden">
              <div className="relative bg-primary px-5 py-4">
                <div className="absolute bottom-0 inset-x-0 h-1 bg-secondary-container" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-h3 text-[18px] text-on-primary">
                      {formatAuditAction(selected.action)}
                    </h3>
                    <p className="text-[12px] text-primary-fixed-dim mt-0.5">
                      {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-primary shrink-0"
                  >
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <DetailBlock label="Done by" value={selected.user.fullName} hint={selected.user.email} />
                <DetailBlock
                  label="About"
                  value={selected.targetLabel}
                  hint={[selected.targetKind, selected.targetSubtitle].filter(Boolean).join(' · ') || null}
                />

                {friendlyMetaLines(selected.meta).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide font-label-bold text-secondary">
                      Change details
                    </p>
                    <ul className="rounded-xl border border-outline-variant divide-y divide-outline-variant/50 overflow-hidden">
                      {friendlyMetaLines(selected.meta).map((line) => (
                        <li
                          key={line.label}
                          className="flex justify-between gap-3 px-3 py-2.5 text-sm bg-surface-container-low/40"
                        >
                          <span className="text-on-surface-variant">{line.label}</span>
                          <span className="font-medium text-on-surface text-right break-all">
                            {line.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <form action={deleteAuditRecord} className="rounded-xl border border-error/30 p-3">
                  <input type="hidden" name="id" value={selected.id} />
                  <input name="reason" required minLength={5} placeholder="Reason for deleting this audit record" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  <button className="mt-2 text-sm text-error underline">Delete audit record</button>
                </form>
              </div>
            </div>
          </div>,
          document.body
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
      <p className="text-[10px] uppercase tracking-wide font-label-bold text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-on-surface">{value}</p>
      {hint ? <p className="text-[12px] text-on-surface-variant mt-0.5">{hint}</p> : null}
    </div>
  )
}
