import { NextResponse, type NextRequest } from 'next/server'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { buildReport, parseReportFilters } from '@/lib/reports'
import { reportCsv, reportDocx, reportPdf } from '@/lib/reports-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Downloads the report shown on the Financial reports page, with the same filters, as CSV, PDF or Word. */
export async function GET(req: NextRequest) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN', 'EXECUTIVE', 'AUDITOR'])
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const format = params.format === 'pdf' || params.format === 'docx' ? params.format : 'csv'
  const filters = parseReportFilters(params)
  const report = await buildReport(filters)
  await writeAudit({
    userId: actor.id,
    action: 'FINANCIAL_REPORT_EXPORT',
    entity: 'Report',
    meta: { report: filters.kind, format, filters, rows: report.rows.length },
  })

  const name = `alubonets-${filters.kind}-${new Date().toISOString().slice(0, 10)}`
  const headers = (type: string, ext: string) => ({ 'content-type': type, 'content-disposition': `attachment; filename="${name}.${ext}"`, 'cache-control': 'private, no-store' })
  if (format === 'pdf') return new NextResponse(new Uint8Array(await reportPdf(report)), { headers: headers('application/pdf', 'pdf') })
  if (format === 'docx') {
    return new NextResponse(new Uint8Array(await reportDocx(report)), { headers: headers('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx') })
  }
  return new NextResponse(reportCsv(report), { headers: headers('text/csv; charset=utf-8', 'csv') })
}
