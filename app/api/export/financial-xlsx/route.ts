import { NextRequest, NextResponse } from 'next/server'
import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { reportRangeFromSearch } from '@/lib/report-period'

function cell(value: unknown) {
  const text = String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`
}

export async function GET(req: NextRequest) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN', 'EXECUTIVE', 'AUDITOR'])
  const { from, to } = reportRangeFromSearch(
    req.nextUrl.searchParams.get('from'),
    req.nextUrl.searchParams.get('to'),
  )
  const category = req.nextUrl.searchParams.get('category')
  const rows = await prisma.financialTransaction.findMany({
    where: {
      occurredAt: { gte: from, lte: to },
      status: { in: ['CONFIRMED', 'RECONCILED'] },
      ...(category ? { categoryId: category } : {}),
    },
    include: { category: true, createdBy: true },
    orderBy: { occurredAt: 'asc' },
  })

  const header = ['Date', 'Number', 'Type', 'Status', 'Category', 'Description', 'Amount KES', 'Reference', 'Created by']
  const body = rows.map((r) => [
    r.occurredAt.toISOString(),
    r.transactionNumber,
    r.type,
    r.status,
    r.category?.name,
    r.description,
    r.amount,
    r.providerReference,
    r.createdBy.fullName,
  ])

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Financial"><Table>
  <Row>${header.map(cell).join('')}</Row>
  ${body.map((row) => `<Row>${row.map(cell).join('')}</Row>`).join('\n  ')}
 </Table></Worksheet>
</Workbook>`

  await writeAudit({
    userId: actor.id,
    action: 'FINANCIAL_REPORT_EXPORT_XLSX',
    entity: 'FinancialTransaction',
    meta: { from, to, category, count: rows.length },
  })

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/vnd.ms-excel; charset=utf-8',
      'content-disposition': 'attachment; filename="alubonets-financial.xls"',
    },
  })
}
