import { NextRequest, NextResponse } from 'next/server'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { getActiveMonthsReport } from '@/lib/active-months-report'

const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export async function GET(req: NextRequest) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN', 'EXECUTIVE', 'AUDITOR'])
  const currentYear = new Date().getUTCFullYear()
  const requested = Number(req.nextUrl.searchParams.get('year'))
  const year = requested >= 2000 && requested <= currentYear + 1 ? requested : currentYear
  const report = await getActiveMonthsReport(year)
  const data = [
    ['Member', 'Membership number', 'Standing', ...report.keys, 'Active months'],
    ...report.rows.map((row) => [
      row.fullName,
      row.membershipNumber,
      row.standing === 'LAPSED' ? 'Lapsed' : 'Paid-up',
      ...row.months.map((paid) => (paid ? 'Paid' : '')),
      row.activeCount,
    ]),
  ]
  await writeAudit({ userId: actor.id, action: 'ACTIVE_MONTHS_EXPORT', entity: 'Contribution', meta: { year, members: report.rows.length } })
  return new NextResponse(data.map((row) => row.map(quote).join(',')).join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="alubonets-active-months-${year}.csv"`,
    },
  })
}
