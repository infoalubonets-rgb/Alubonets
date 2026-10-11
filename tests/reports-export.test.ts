import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { reportCsv, reportDocx, reportPdf } from '../lib/reports-export'
import type { Report } from '../lib/reports'

const report: Report = {
  kind: 'monthly',
  title: 'Member contributions per month',
  subtitle: '2026 · confirmed payments (KES)',
  kpis: [
    { label: 'Collected', value: 'KES 20,956' },
    { label: 'Members who paid', value: '6 of 11' },
    { label: 'Average per paying member', value: 'KES 3,492.67' },
    { label: 'Best month', value: 'Oct · KES 11,200' },
  ],
  columns: [{ label: 'Member' }, ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label) => ({ label, align: 'right' as const })), { label: 'Total', align: 'right' }, { label: 'Months', align: 'right' }],
  // Enough rows to force a second PDF page, and characters the standard PDF font lacks (−, —).
  rows: Array.from({ length: 60 }, (_, i) => [`Member "${i}", Nairobi`, ...Array(12).fill('—'), '−1,000', '0/12']),
  totals: ['Month total', ...Array(12).fill('0'), '20,956', ''],
}

describe('report downloads', () => {
  it('CSV quotes values and includes header, rows and totals', () => {
    const csv = reportCsv(report)
    const lines = csv.replace('﻿', '').split('\r\n')
    expect(lines).toHaveLength(62)
    expect(lines[0].startsWith('"Member","Jan"')).toBe(true)
    expect(lines[1]).toContain('"Member ""0"", Nairobi"')
    expect(lines.at(-1)).toContain('"Month total"')
  })

  it('PDF is a real multi-page PDF', async () => {
    const pdf = await reportPdf(report)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    // 60 rows do not fit on one landscape page, so the table continues on a second.
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1)
  })

  it('Word file is a real .docx (zip) document', async () => {
    const docx = await reportDocx(report)
    expect(docx.subarray(0, 2).toString()).toBe('PK')
    expect(docx.length).toBeGreaterThan(2000)
  })
})
