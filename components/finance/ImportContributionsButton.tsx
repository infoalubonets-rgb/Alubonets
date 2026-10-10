'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { CONTRIBUTION_CSV_HEADERS } from '@/lib/contribution-csv'
import { importContributionsCsv, validateContributionImport, getContributionResolveMembers, resolveImportedContribution } from '@/app/actions/import-contributions'

export default function ImportContributionsButton() {
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<{ count: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [unresolved, setUnresolved] = useState<Awaited<ReturnType<typeof validateContributionImport>>['unresolved']>([])
  const [resolving, setResolving] = useState<(typeof unresolved)[number] | null>(null)
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getContributionResolveMembers>>>([])
  const [memberId, setMemberId] = useState('')
  const [resolveError, setResolveError] = useState('')
  const router = useRouter()
  function download() {
    const url = URL.createObjectURL(new Blob([CONTRIBUTION_CSV_HEADERS.join(',') + '\r\n'], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'contributions-template.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-on-primary shadow-sm">
      <span className="material-symbols-outlined text-[18px]">upload</span>Import contributions
    </button>
    <FullScreenModal open={open} title="Import contributions" onClose={() => { if (!busy) setOpen(false) }} size="compact">
      <div className="space-y-4">
        <button type="button" onClick={download} className="rounded-full bg-secondary-container px-4 py-2 text-sm font-semibold text-on-primary">Download CSV template</button>
        <label className="block text-sm">Completed CSV
          <input type="file" accept=".csv,text/csv" disabled={busy} className="mt-2 block w-full" onChange={async (e) => {
            setPreview(null); setCsv(''); setMessage(''); setUnresolved([])
            const file = e.target.files?.[0]; if (!file) return
            if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1_000_000) { setMessage('Choose a CSV smaller than 1 MB.'); return }
            setBusy(true)
            try { const text = await file.text(); const result = await validateContributionImport(text); setCsv(text); setPreview(result); setUnresolved(result.unresolved) }
            catch (error) { setMessage(error instanceof Error ? error.message : 'Could not validate CSV.') }
            finally { setBusy(false) }
          }} />
        </label>
        {preview && <p className="rounded-xl bg-primary/5 p-3 text-sm">Ready to import {preview.count} payments totalling KES {preview.total.toLocaleString()}.</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {unresolved.length > 0 && <section className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700 dark:bg-red-950/30 dark:text-red-300">
          <h3 className="text-sm font-semibold">Unresolved ({unresolved.length})</h3>
          <p className="mt-1 text-xs">No unique member matches these emails. Resolve a payment to attach it to an existing member.</p>
          <ul className="mt-2 max-h-48 space-y-2 overflow-auto text-xs">{unresolved.map((row) => <li key={row.rowNumber} className="flex items-center justify-between gap-3">
            <span>Row {row.rowNumber}: {row.email} · KES {row.amount.toLocaleString()} · {row.reference}</span>
            <button type="button" disabled={busy} className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50" onClick={async () => {
              setBusy(true); setMemberId(''); setResolveError('')
              try { setMembers(await getContributionResolveMembers()); setResolving(row) }
              catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load members.') }
              finally { setBusy(false) }
            }}>Resolve</button>
          </li>)}</ul>
          <button type="button" className="mt-3 text-xs font-semibold underline" onClick={() => {
            const text = Papa.unparse({ fields: [...CONTRIBUTION_CSV_HEADERS], data: unresolved.map((r) => CONTRIBUTION_CSV_HEADERS.map((h) => r.data[h])) })
            const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
            const a = document.createElement('a'); a.href = url; a.download = 'unresolved-contributions.csv'; a.click(); URL.revokeObjectURL(url)
          }}>Download unresolved rows</button>
        </section>}
        <button type="button" disabled={!preview?.count || busy} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50" onClick={async () => {
          setBusy(true); setMessage('')
          try { const result = await importContributionsCsv(csv); setMessage(result.error || `${result.imported} contributions imported successfully. ${result.unresolved.length} unresolved.`); setUnresolved(result.unresolved); setPreview(null); setCsv(''); router.refresh() }
          catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); setPreview(null) }
          finally { setBusy(false) }
        }}>{busy ? 'Processing…' : 'Import payments'}</button>
      </div>
    </FullScreenModal>
    <FullScreenModal open={Boolean(resolving)} title="Resolve contribution" onClose={() => { if (!busy) setResolving(null) }} size="compact">
      {resolving && <div className="space-y-4">
        <p className="text-sm">{resolving.email} · KES {resolving.amount.toLocaleString()} · {resolving.reference}</p>
        <label className="block text-sm">Attach to member
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border bg-surface px-3 py-2">
            <option value="">Select existing member</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.fullName} — {member.email}</option>)}
          </select>
        </label>
        {resolveError && <p role="alert" className="text-sm text-red-600">{resolveError}</p>}
        <button type="button" disabled={!memberId || busy} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={async () => {
          setBusy(true); setResolveError('')
          try {
            const singleCsv = Papa.unparse({ fields: [...CONTRIBUTION_CSV_HEADERS], data: [CONTRIBUTION_CSV_HEADERS.map((key) => resolving.data[key])] })
            const result = await resolveImportedContribution(singleCsv, memberId)
            // This row has now been saved: exclude it from a later bulk import.
            if (csv) {
              const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', transformHeader: (s) => s.trim(), transform: (s) => s.trim() })
              const remaining = parsed.data.filter((row) => row.transaction_reference !== resolving.reference)
              setCsv(Papa.unparse({ fields: [...CONTRIBUTION_CSV_HEADERS], data: remaining.map((row) => CONTRIBUTION_CSV_HEADERS.map((key) => row[key])) }))
            }
            setUnresolved((rows) => rows.filter((row) => row.reference !== resolving.reference))
            setMessage(`Contribution saved for ${result.email}.`); setResolving(null); router.refresh()
          } catch (error) { setResolveError(error instanceof Error ? error.message : 'Could not resolve contribution.') }
          finally { setBusy(false) }
        }}>{busy ? 'Resolving…' : 'Resolve and save contribution'}</button>
      </div>}
    </FullScreenModal>
  </>
}
