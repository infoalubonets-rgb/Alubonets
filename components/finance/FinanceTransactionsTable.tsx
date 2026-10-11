'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import ReconcilePaymentButton, { type ReconcilePayment, type ReconciliationInfo } from '@/components/finance/ReconcilePaymentButton'
import { actionEmailReceipt } from '@/app/actions/domain'

export type FinanceTxRow = {
  id: string
  date: string
  dateTime: string
  name: string
  email: string | null
  phone: string | null
  purpose: string
  method: string
  status: string
  flow: 'in' | 'out' | 'other'
  amount: number
  number: string
  reference: string | null
  statementRef: string | null
  period: string | null
  description: string
  recordedBy: string
  approvedBy: string | null
  documents: number
  /** Present for member payments: receipt, email and reconcile actions. */
  contributionId: string | null
  reconcile: ReconcilePayment | null
  reconciliation: ReconciliationInfo
}

const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')
const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-primary/10 text-primary',
  RECONCILED: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  PENDING: 'bg-secondary-fixed text-secondary',
  REVERSED: 'bg-surface-container text-on-surface-variant',
  REJECTED: 'bg-error-container text-error',
}

/** The page's transaction table: one row per ledger entry, an eye for all details and actions. */
export default function FinanceTransactionsTable({ rows }: { rows: FinanceTxRow[] }) {
  const [viewing, setViewing] = useState<FinanceTxRow | null>(null)
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Purpose</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="w-12 px-3 py-2 text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-on-surface-variant">No transactions match.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-outline-variant/60 hover:bg-primary/[0.03]">
                <td className="whitespace-nowrap px-3 py-2 text-on-surface-variant">{row.date}</td>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">
                  {row.purpose}
                  {row.period && <span className="text-xs text-on-surface-variant"> · {row.period}</span>}
                </td>
                <td className="px-3 py-2">{row.method}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[row.status] ?? 'bg-surface-container'}`}>{label(row.status)}</span>
                </td>
                <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${row.flow === 'in' ? 'text-green-700 dark:text-green-300' : row.flow === 'out' ? 'text-error' : ''}`}>
                  {row.flow === 'in' ? '+' : row.flow === 'out' ? '−' : ''}{kes(row.amount)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={() => setViewing(row)} title="See details" aria-label={`See details for ${row.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-primary hover:bg-primary/5">
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FullScreenModal open={Boolean(viewing)} title={viewing ? `${viewing.name} · ${kes(viewing.amount)}` : 'Transaction'} onClose={() => setViewing(null)} size="wide">
        {viewing && <TransactionDetail row={viewing} />}
      </FullScreenModal>
    </>
  )
}

function TransactionDetail({ row }: { row: FinanceTxRow }) {
  const facts = [
    { label: 'Date & time', value: row.dateTime },
    { label: 'Name', value: row.name },
    { label: 'Contact', value: [row.email, row.phone].filter(Boolean).join(' · ') },
    { label: 'Purpose', value: `${row.purpose}${row.period ? ` · covers ${row.period}` : ''}` },
    { label: 'Amount', value: kes(row.amount) },
    { label: 'Method', value: row.method },
    { label: 'Status', value: label(row.status) },
    { label: 'Payment reference', value: row.reference ?? '—' },
    { label: 'Statement reference', value: row.statementRef ?? '—' },
    { label: 'Transaction number', value: row.number },
    { label: 'Description', value: row.description },
    { label: 'Recorded by', value: row.recordedBy },
    { label: 'Approved by', value: row.approvedBy ?? '—' },
    { label: 'Supporting documents', value: row.documents ? String(row.documents) : 'None' },
  ]
  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 border-b border-outline-variant/40 pb-1.5">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{fact.label}</dt>
            <dd className="break-words text-sm text-on-surface">{fact.value || '—'}</dd>
          </div>
        ))}
      </dl>

      {row.reconciliation && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-200">
          Reconciled by {row.reconciliation.reconciledBy} on {new Date(row.reconciliation.reconciledAt).toLocaleDateString('en-GB')}{row.reconciliation.notes ? ` — ${row.reconciliation.notes}` : ''}
        </p>
      )}

      {row.contributionId ? (
        <section className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 pt-4">
          {row.reconcile && <ReconcilePaymentButton payment={row.reconcile} reconciliation={row.reconciliation} />}
          <a href={`/api/pdf/receipt/${row.contributionId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3.5 text-sm font-semibold text-primary hover:bg-primary/5">
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Receipt PDF
          </a>
          <form action={actionEmailReceipt}>
            <input type="hidden" name="id" value={row.contributionId} />
            <button disabled={!row.email} title={row.email ? `Email the receipt to ${row.email}` : 'This member has no email address'} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">mail</span>
              Email receipt
            </button>
          </form>
        </section>
      ) : (
        <p className="border-t border-outline-variant/60 pt-4 text-xs text-on-surface-variant">Receipts and reconciliation apply to member payments.</p>
      )}
    </div>
  )
}
