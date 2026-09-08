import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`

export async function GET(request: NextRequest) {
  const actor = await requireAdmin()
  const fromRaw = request.nextUrl.searchParams.get('from')
  const toRaw = request.nextUrl.searchParams.get('to')
  const rows = await prisma.auditLog.findMany({
    where: {
      ...((fromRaw || toRaw)
        ? {
            createdAt: {
              ...(fromRaw ? { gte: new Date(fromRaw) } : {}),
              ...(toRaw ? { lte: new Date(`${toRaw}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    },
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const output = [['Time','Actor','Email','Action','Entity','Entity ID','Reason','Old value','New value','Metadata','IP','Device'], ...rows.map((row)=>[row.createdAt.toISOString(),row.user?.fullName ?? '',row.user?.email ?? '',row.action,row.entity,row.entityId,row.reason,JSON.stringify(row.oldValue),JSON.stringify(row.newValue),JSON.stringify(row.meta),row.ipAddress,row.userAgent])]
  await writeAudit({ userId: actor.id, action: 'AUDIT_EXPORT', entity: 'AuditLog', meta: { count: rows.length, fromRaw, toRaw } })
  return new NextResponse(output.map((row)=>row.map(csv).join(',')).join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="alubonets-audit.csv"' } })
}
