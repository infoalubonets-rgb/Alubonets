import { NextResponse } from 'next/server'
import type { TransactionStatus } from '@prisma/client'
import { getSessionProfile } from '@/lib/auth/session'
import { canViewAllFinances } from '@/lib/finance-access'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const statuses: { in: TransactionStatus[] } = { in: ['CONFIRMED', 'RECONCILED', 'PENDING', 'REJECTED'] }

type Row = {
  id: string
  userId: string
  amount: number
  paidAt: Date
  category: string | null
  status: string
  paymentMethod: string | null
  mpesaRef: string | null
  transactionCategory: { name: string } | null
  campaign: { title: string } | null
  project: { title: string } | null
}

const toView = (c: Row) => ({
  id: c.id,
  amount: c.amount,
  paidAt: c.paidAt.toISOString(),
  purpose: c.campaign?.title || c.project?.title || c.transactionCategory?.name || c.category || '—',
  status: c.status,
  method: c.paymentMethod,
  reference: c.mpesaRef,
})

/** One member's contributions for the Members' contributions pop-up (finance viewers only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // The data queries start alongside the session check; nothing is returned until it passes.
  const [profile, member, rows] = await Promise.all([
    getSessionProfile(),
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        membershipNumber: true,
        standing: true,
        attachedMembers: { select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } },
      },
    }),
    prisma.contribution.findMany({
      where: { status: statuses, OR: [{ userId: id }, { user: { principalMemberId: id } }] },
      select: {
        id: true,
        userId: true,
        amount: true,
        paidAt: true,
        category: true,
        status: true,
        paymentMethod: true,
        mpesaRef: true,
        transactionCategory: { select: { name: true } },
        campaign: { select: { title: true } },
        project: { select: { title: true } },
      },
      orderBy: { paidAt: 'desc' },
    }),
  ])
  if (!profile) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  if (!canViewAllFinances(profile)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })

  return NextResponse.json(
    {
      member: { id: member.id, fullName: member.fullName, membershipNumber: member.membershipNumber, standing: member.standing },
      contributions: rows.filter((c) => c.userId === member.id).map(toView),
      family: member.attachedMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        contributions: rows.filter((c) => c.userId === m.id).map(toView),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
