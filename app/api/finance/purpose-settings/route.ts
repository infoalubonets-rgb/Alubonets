import { NextResponse, type NextRequest } from 'next/server'
import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getPurposeRules } from '@/lib/contribution-purpose-settings'
import { isSystemCategoryCode } from '@/lib/payment-categories'
import { getStandingSettings } from '@/lib/membership-standing-settings'
import { memberPurposeRules, purposeBalance } from '@/lib/contribution-purpose-rules'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  await requireActiveRole(['ADMIN', 'TREASURER'])
  const memberId = request.nextUrl.searchParams.get('member') || ''
  const [categories, config, standing, members] = await Promise.all([
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, type: true, billingKind: true, fixedAmountKes: true } }),
    getPurposeRules(), getStandingSettings(),
    memberId ? prisma.user.findMany({ where: { id: memberId }, select: { id: true, fullName: true, email: true, createdAt: true, approvedAt: true, contributionPlan: true } }) : prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true, createdAt: true, approvedAt: true, contributionPlan: true } }),
  ])
  const payments = memberId ? await prisma.contribution.findMany({ where: { userId: memberId, status: { in: ['CONFIRMED', 'RECONCILED'] } }, select: { categoryId: true, amount: true, paidAt: true } }) : []
  const balances = memberId && members[0] ? memberPurposeRules(config.rules, config.overrides, memberId).map(({ rule, enabled }) => {
    return { categoryId: rule.categoryId, enabled, ...purposeBalance(rule, members[0].approvedAt ?? members[0].createdAt, payments.filter(p => p.categoryId === rule.categoryId)) }
  }) : []
  return NextResponse.json({ categories: categories.filter(c => !isSystemCategoryCode(c.code) && c.type !== 'EXPENSE'), rules: config.rules, overrides: config.overrides.filter(o => o.userId === memberId), members, standing, balances }, { headers: { 'Cache-Control': 'private, no-store' } })
}
