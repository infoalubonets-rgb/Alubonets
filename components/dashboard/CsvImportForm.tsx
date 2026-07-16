'use client'

import { useState } from 'react'
import { actionImportContributionsCsv } from '@/app/actions/domain'

export default function CsvImportForm() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setLoading(true)
        setStatus('')
        try {
          const fd = new FormData(e.currentTarget)
          const file = fd.get('file') as File | null
          if (!file) throw new Error('Choose a CSV file')
          const text = await file.text()
          const result = await actionImportContributionsCsv(text)
          setStatus(`Imported ${result.created} rows`)
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Import failed')
        } finally {
          setLoading(false)
        }
      }}
    >
      <input type="file" name="file" accept=".csv,text/csv" required />
      <button
        type="submit"
        disabled={loading}
        className="block bg-primary text-on-primary rounded-lg px-4 py-2 disabled:opacity-60"
      >
        {loading ? 'Importing…' : 'Import CSV'}
      </button>
      {status && <p className="text-sm text-on-surface-variant">{status}</p>}
    </form>
  )
}
