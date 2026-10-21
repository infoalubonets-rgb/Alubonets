import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { canViewAllFinances } from '@/lib/finance-access'
import { prisma } from '@/lib/prisma'
import { APP_TIMEZONE, appDayRange } from '@/lib/dates'
import { NOT_DELETED_MEMBER } from '@/lib/deleted-member'

export const dynamic = 'force-dynamic'

/**
 * Members × months grid for one year: each cell is what that member paid (confirmed) in that
 * month, by the payment date in the group's timezone. For finance staff only.
 */
export async function GET(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  if (!canViewAllFinances(profile)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })

  const now = new Date()
  const requested = Number(new URL(request.url).searchParams.get('year'))
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= now.getFullYear() + 1 ? requested : now.getFullYear()

  const [members, contributions, firstPayment] = await Promise.all([
    prisma.user.findMany({
      where: { status: { not: 'PENDING' }, ...NOT_DELETED_MEMBER },
      select: { id: true, fullName: true, membershipNumber: true, contributionPlan: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.contribution.findMany({
      where: {
        status: { in: ['CONFIRMED', 'RECONCILED'] },
        paidAt: { gte: appDayRange(`${year}-01-01`).start, lte: appDayRange(`${year}-12-31`).end },
      },
      select: { userId: true, amount: true, paidAt: true },
    }),
    prisma.contribution.findFirst({ where: { status: { in: ['CONFIRMED', 'RECONCILED'] } }, orderBy: { paidAt: 'asc' }, select: { paidAt: true } }),
  ])

  const monthOf = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit' })
  const cells = new Map<string, number[]>()
  for (const c of contributions) {
    const index = Number(monthOf.format(c.paidAt).slice(5, 7)) - 1
    const row = cells.get(c.userId) ?? Array(12).fill(0)
    row[index] += c.amount
    cells.set(c.userId, row)
  }

  const rows = members.map((m) => {
    const values = cells.get(m.id) ?? Array(12).fill(0)
    return {
      id: m.id,
      name: m.fullName,
      membershipNumber: m.membershipNumber,
      plan: m.contributionPlan,
      cells: values,
      total: values.reduce((sum: number, v: number) => sum + v, 0),
      activeMonths: values.filter((v: number) => v > 0).length,
    }
  })
  const firstYear = firstPayment ? Number(monthOf.format(firstPayment.paidAt).slice(0, 4)) : year

  return NextResponse.json(
    {
      year,
      years: Array.from({ length: Math.max(1, now.getFullYear() - Math.min(firstYear, year) + 1) }, (_, i) => now.getFullYear() - i),
      months: Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(year, i, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })),
      rows,
      monthTotals: Array.from({ length: 12 }, (_, i) => rows.reduce((sum, r) => sum + r.cells[i], 0)),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
