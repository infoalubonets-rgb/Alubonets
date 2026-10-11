import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { notifyUsers } from '@/lib/notifications'
import {
  computeStanding,
  isDependent,
  resolveFamilyStanding,
  type Standing,
  type StandingPayment,
  type StandingSettings,
} from '@/lib/membership-standing'
import { getStandingSettings } from '@/lib/membership-standing-settings'
import { getPurposeRules } from '@/lib/contribution-purpose-settings'
import { memberPurposeRules, purposeBalance } from '@/lib/contribution-purpose-rules'

type StandingUser = {
  id: string
  approvedAt: Date | null
  createdAt: Date
  principalMemberId: string | null
  isPrincipal: boolean
  standing: Standing
  standingReason: string | null
  standingOverride: Standing | null
  standingOverrideUntil: Date | null
  contributionExempt: boolean
  contributionPlan: 'MONTHLY' | 'ANNUAL' | null
  memberProfile: { dateOfBirth: Date | null } | null
}

const userSelect = {
  id: true,
  approvedAt: true,
  createdAt: true,
  principalMemberId: true,
  isPrincipal: true,
  standing: true,
  standingReason: true,
  standingOverride: true,
  standingOverrideUntil: true,
  contributionExempt: true,
  contributionPlan: true,
  memberProfile: { select: { dateOfBirth: true } },
} as const

async function paymentsByUser(userIds: string[]) {
  const rows = await prisma.contribution.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ['CONFIRMED', 'RECONCILED'] },
      transactionCategory: { billingKind: { in: ['MONTHLY', 'ANNUAL'] } },
    },
    select: { userId: true, amount: true, paidAt: true, transactionCategory: { select: { billingKind: true } } },
  })
  const map = new Map<string, StandingPayment[]>()
  for (const row of rows) {
    const kind = row.transactionCategory?.billingKind
    if (kind !== 'MONTHLY' && kind !== 'ANNUAL') continue
    const list = map.get(row.userId) ?? []
    list.push({ amount: row.amount, paidAt: row.paidAt, billingKind: kind })
    map.set(row.userId, list)
  }
  return map
}

function evaluate(user: StandingUser, payments: StandingPayment[], settings: StandingSettings, now: Date) {
  return computeStanding(
    payments,
    {
      joinedAt: user.approvedAt ?? user.createdAt,
      override: user.standingOverride,
      overrideUntil: user.standingOverrideUntil,
      plan: user.contributionPlan,
    },
    settings,
    now,
  )
}

async function applyResults(users: StandingUser[], settings: StandingSettings, actorId?: string) {
  const now = new Date()
  const payments = await paymentsByUser(users.map((user) => user.id))
  const { rules, overrides } = await getPurposeRules()
  const purposePayments = rules.length || overrides.length ? await prisma.contribution.findMany({
    where: { userId: { in: users.map(u => u.id) }, status: { in: ['CONFIRMED', 'RECONCILED'] } },
    select: { userId: true, categoryId: true, amount: true, paidAt: true },
  }) : []
  const own = new Map(users.map(user => {
    const assigned = memberPurposeRules(rules, overrides, user.id)
    const membership = assigned.filter(a => a.rule.memberContribution && (!user.contributionPlan || a.rule.frequency === user.contributionPlan))
    const memberSettings = { ...settings,
      ...(membership.some(a => a.rule.frequency === 'MONTHLY') ? { monthlyFeeKes: 0 } : {}),
      ...(membership.some(a => a.rule.frequency === 'ANNUAL') ? { annualFeeKes: 0 } : {}),
    }
    const result = evaluate(user, payments.get(user.id) ?? [], memberSettings, now)
    if (user.standingOverride && (!user.standingOverrideUntil || user.standingOverrideUntil > now)) return [user.id, result] as const
    const reasons: string[] = result.reason ? [result.reason] : []
    for (const { rule, enabled } of membership) {
      if (!enabled) continue
      const balance = purposeBalance(rule, user.approvedAt ?? user.createdAt,
        purposePayments.filter(p => p.userId === user.id && p.categoryId === rule.categoryId), now)
      if (balance.outstanding > 0) {
        reasons.push(`${rule.frequency === 'ANNUAL' ? 'Annual' : 'Monthly'} contribution overdue: KES ${balance.outstanding.toLocaleString()}`)
        if (rule.frequency === 'MONTHLY') result.monthlyArrearsKes += balance.outstanding
      }
    }
    if (reasons.length) { result.standing = 'LAPSED'; result.reason = reasons.join('; ') }
    return [user.id, result] as const
  }))

  const principalIds = users.map((u) => u.principalMemberId).filter((id): id is string => Boolean(id) && !own.has(id as string))
  const outsidePrincipals = principalIds.length
    ? await prisma.user.findMany({ where: { id: { in: principalIds } }, select: { id: true, standing: true } })
    : []
  const principalStanding = new Map<string, Standing>(outsidePrincipals.map((p) => [p.id, p.standing]))
  for (const [id, result] of own) principalStanding.set(id, result.standing)

  let lapsed = 0
  let reactivated = 0
  const unchanged: string[] = []
  for (const user of users) {
    const manual = Boolean(user.standingOverride && (!user.standingOverrideUntil || user.standingOverrideUntil > now))
    const result = resolveFamilyStanding(own.get(user.id)!, {
      manual,
      dependent: isDependent({ contributionExempt: user.contributionExempt, dateOfBirth: user.memberProfile?.dateOfBirth ?? null }, now),
      principalStanding: user.principalMemberId ? principalStanding.get(user.principalMemberId) ?? null : null,
    })
    const expiredOverride = user.standingOverride && user.standingOverrideUntil && user.standingOverrideUntil <= now
    const changed = result.standing !== user.standing || result.reason !== user.standingReason
    if (!changed && !expiredOverride) {
      unchanged.push(user.id)
      continue
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        standing: result.standing,
        standingReason: result.reason,
        standingCheckedAt: now,
        ...(expiredOverride ? { standingOverride: null, standingOverrideUntil: null } : {}),
      },
    })
    if (result.standing === user.standing) continue
    if (result.standing === 'LAPSED') lapsed += 1
    else reactivated += 1
    await writeAudit({
      userId: actorId ?? user.id,
      action: result.standing === 'LAPSED' ? 'MEMBER_STANDING_LAPSED' : 'MEMBER_STANDING_PAID_UP',
      entity: 'User',
      entityId: user.id,
      reason: result.reason ?? 'Required payments complete',
      oldValue: { standing: user.standing },
      newValue: { standing: result.standing },
    })
    await notifyUsers({
      userIds: [user.id],
      title: result.standing === 'LAPSED' ? 'Your membership has lapsed' : 'Your membership is active again',
      body: result.standing === 'LAPSED'
        ? `${result.reason ?? 'Required payments are overdue'}. Upcoming events and projects are hidden until you are paid up.`
        : 'Thank you — your required payments are complete and full member access is restored.',
      href: '/contributions',
      type: 'membership',
      entity: 'User',
      entityId: user.id,
    })
  }
  if (unchanged.length) {
    await prisma.user.updateMany({ where: { id: { in: unchanged } }, data: { standingCheckedAt: now } })
  }
  return { checked: users.length, lapsed, reactivated }
}

/** Re-evaluates one member (plus their attached family when they are a Principal). */
export async function recomputeMemberStanding(userId: string, actorId?: string) {
  const settings = await getStandingSettings()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect })
  if (!user) return { checked: 0, lapsed: 0, reactivated: 0 }
  const family = user.isPrincipal
    ? await prisma.user.findMany({ where: { principalMemberId: user.id, status: 'ACTIVE' }, select: userSelect })
    : []
  const first = await applyResults([user], settings, actorId)
  const rest = family.length ? await applyResults(family, settings, actorId) : { checked: 0, lapsed: 0, reactivated: 0 }
  return {
    checked: first.checked + rest.checked,
    lapsed: first.lapsed + rest.lapsed,
    reactivated: first.reactivated + rest.reactivated,
  }
}

/** Nightly/hourly sweep over every active member. Principals run first so dependents can follow them. */
export async function syncMembershipStanding() {
  const settings = await getStandingSettings()
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: userSelect })
  const principals = users.filter((u) => !u.principalMemberId)
  const attached = users.filter((u) => u.principalMemberId)
  const a = await applyResults(principals, settings)
  const b = attached.length ? await applyResults(attached, settings) : { checked: 0, lapsed: 0, reactivated: 0 }
  return { checked: a.checked + b.checked, lapsed: a.lapsed + b.lapsed, reactivated: a.reactivated + b.reactivated }
}

/** Current standing for page guards — read from the database so it is never stale. */
export async function getMemberStanding(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { standing: true, standingReason: true },
  })
  return { standing: (user?.standing ?? 'PAID_UP') as Standing, reason: user?.standingReason ?? null }
}

