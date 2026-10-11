import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { AlignmentType, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import type { Report } from '@/lib/reports'

const generatedOn = () => new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** CSV: header, the rows and the totals row. */
export function reportCsv(report: Report) {
  const q = (v: string) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lines = [report.columns.map((c) => c.label), ...report.rows, ...(report.totals ? [report.totals] : [])]
  return '﻿' + lines.map((line) => line.map(q).join(',')).join('\r\n')
}

/** PDF: landscape A4, KPIs at the top, then a paged table with a repeated header. */
export async function reportPdf(report: Report) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 842, H = 595, M = 32
  const NAVY = rgb(0, 0.122, 0.314), MUTED = rgb(0.4, 0.42, 0.46), LINE = rgb(0.85, 0.86, 0.9), STRIPE = rgb(0.96, 0.97, 0.99)
  // Standard PDF fonts cannot draw some characters; swap them for safe ones.
  const safe = (text: string) => text.replaceAll('−', '-').replaceAll('–', '-').replaceAll('—', '-').replace(/[^\x20-\x7E -ÿ]/g, '?')
  const fit = (text: string, f: PDFFont, size: number, width: number) => {
    let out = safe(text)
    while (out.length > 2 && f.widthOfTextAtSize(out, size) > width) out = out.slice(0, -3) + '..'
    return out
  }

  const size = report.columns.length > 10 ? 7 : 8.5
  const usable = W - M * 2
  // First column (names) gets more room; the rest share the remaining width.
  const firstWidth = Math.min(200, usable * (report.columns.length > 10 ? 0.2 : 0.24))
  const restWidth = (usable - firstWidth) / Math.max(1, report.columns.length - 1)
  const widths = report.columns.map((_, i) => (i === 0 ? firstWidth : restWidth))
  const rowH = size + 8

  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M
  const header = () => {
    let x = M
    page.drawRectangle({ x: M, y: y - rowH + 3, width: usable, height: rowH, color: NAVY })
    report.columns.forEach((col, i) => {
      const text = fit(col.label, bold, size, widths[i] - 6)
      const tx = col.align === 'right' ? x + widths[i] - 3 - bold.widthOfTextAtSize(text, size) : x + 3
      page.drawText(text, { x: tx, y: y - size, size, font: bold, color: rgb(1, 1, 1) })
      x += widths[i]
    })
    y -= rowH
  }
  const row = (cells: string[], f: PDFFont, shade: boolean) => {
    if (y - rowH < M + 14) {
      page = pdf.addPage([W, H])
      y = H - M
      header()
    }
    if (shade) page.drawRectangle({ x: M, y: y - rowH + 3, width: usable, height: rowH, color: STRIPE })
    let x = M
    cells.forEach((cell, i) => {
      const text = fit(cell, f, size, widths[i] - 6)
      const tx = report.columns[i]?.align === 'right' ? x + widths[i] - 3 - f.widthOfTextAtSize(text, size) : x + 3
      page.drawText(text, { x: tx, y: y - size, size, font: f, color: rgb(0.08, 0.08, 0.1) })
      x += widths[i]
    })
    page.drawLine({ start: { x: M, y: y - rowH + 3 }, end: { x: W - M, y: y - rowH + 3 }, thickness: 0.4, color: LINE })
    y -= rowH
  }

  page.drawText(safe(`Alubonets SHG · ${report.title}`), { x: M, y: y - 14, size: 16, font: bold, color: NAVY })
  y -= 22
  page.drawText(safe(`${report.subtitle} · generated ${generatedOn()}`), { x: M, y: y - 9, size: 9, font, color: MUTED })
  y -= 26
  const kpiW = usable / report.kpis.length
  report.kpis.forEach((kpi, i) => {
    const x = M + i * kpiW
    page.drawRectangle({ x: x + 2, y: y - 38, width: kpiW - 4, height: 38, borderColor: LINE, borderWidth: 0.8 })
    page.drawText(fit(kpi.label.toUpperCase(), font, 7, kpiW - 16), { x: x + 9, y: y - 13, size: 7, font, color: MUTED })
    page.drawText(fit(kpi.value, bold, 12, kpiW - 16), { x: x + 9, y: y - 30, size: 12, font: bold, color: NAVY })
  })
  y -= 50

  header()
  report.rows.forEach((cells, i) => row(cells, font, i % 2 === 1))
  if (!report.rows.length) row(['No data for these filters.', ...report.columns.slice(1).map(() => '')], font, false)
  if (report.totals) row(report.totals, bold, false)

  pdf.getPages().forEach((p, i, all) => p.drawText(`Page ${i + 1} of ${all.length}`, { x: W - M - 60, y: 16, size: 8, font, color: MUTED }))
  return Buffer.from(await pdf.save())
}

/** Word: landscape document with the KPIs as a line and the report as a table. */
export async function reportDocx(report: Report) {
  const cell = (text: string, opts: { bold?: boolean; right?: boolean; shade?: string } = {}) =>
    new TableCell({
      children: [new Paragraph({ alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: opts.bold, size: 16, color: opts.shade ? 'FFFFFF' : undefined })] })],
      shading: opts.shade ? { fill: opts.shade } : undefined,
    })
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: report.columns.map((c) => cell(c.label, { bold: true, right: c.align === 'right', shade: '001F50' })) }),
      ...report.rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, { right: report.columns[i]?.align === 'right' })) })),
      ...(report.totals ? [new TableRow({ children: report.totals.map((v, i) => cell(v, { bold: true, right: report.columns[i]?.align === 'right' })) })] : []),
    ],
  })
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: `Alubonets SHG · ${report.title}`, bold: true, size: 32, color: '001F50' })] }),
        new Paragraph({ children: [new TextRun({ text: `${report.subtitle} · generated ${generatedOn()}`, size: 18, color: '666B75' })] }),
        new Paragraph({ spacing: { before: 160, after: 160 }, children: report.kpis.flatMap((k, i) => [
          new TextRun({ text: `${i ? '     ' : ''}${k.label}: `, size: 18, color: '666B75' }),
          new TextRun({ text: k.value, bold: true, size: 20, color: '001F50' }),
        ]) }),
        report.rows.length ? table : new Paragraph('No data for these filters.'),
      ],
    }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
