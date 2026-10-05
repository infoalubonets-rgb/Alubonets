import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { compareMonths, currentAccountingMonth } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The old month an admin is working in, if any — drives the "switch back" pill on every page. */
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile || (profile.role !== 'ADMIN' && !profile.isSuperAdmin)) return NextResponse.json({ oldMonth: null })

  const current = currentAccountingMonth()
  const open = await prisma.accountingPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startsAt: 'desc' } })
  if (!open || compareMonths(open, current) >= 0) return NextResponse.json({ oldMonth: null })

  return NextResponse.json({
    oldMonth: {
      key: `${open.year}-${String(open.month).padStart(2, '0')}`,
      label: monthLabel(open.year, open.month),
    },
    currentLabel: monthLabel(current.year, current.month),
  })
}
