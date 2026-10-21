import { prisma } from '@/lib/prisma'
import { nextMembershipNumber } from '@/lib/membership'
import { NOT_DELETED_MEMBER, isDeletedMemberEmail } from '@/lib/deleted-member'

/**
 * Accounts that never went through approval (bootstrap admins, seeded officers) were created
 * without a member ID. These give them one, using the same AL + YYMM + counter sequence as an
 * approval. An ID is only ever set where none exists, so it never changes once given.
 */
async function assignMembershipNumber(userId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId }, select: { membershipNumber: true } })
    if (!current || current.membershipNumber) return current?.membershipNumber ?? null
    const number = await nextMembershipNumber(tx)
    await tx.user.updateMany({ where: { id: userId, membershipNumber: null }, data: { membershipNumber: number } })
    return number
  })
}

/** Returns the member's ID, giving them one first if an approved account has none. */
export async function ensureMembershipNumber(user: { id: string; membershipNumber: string | null; status: string; email?: string | null }) {
  if (user.membershipNumber || user.status === 'PENDING' || isDeletedMemberEmail(user.email)) return user.membershipNumber
  try {
    return await assignMembershipNumber(user.id)
  } catch (error) {
    console.error('[member-id] could not assign a member ID', error)
    return null
  }
}

/** Gives every approved account that still lacks a member ID one (oldest first). Returns how many. */
export async function assignMissingMembershipNumbers() {
  const missing = await prisma.user.findMany({
    where: { membershipNumber: null, status: { not: 'PENDING' }, ...NOT_DELETED_MEMBER },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  let assigned = 0
  for (const user of missing) {
    try {
      if (await assignMembershipNumber(user.id)) assigned += 1
    } catch (error) {
      console.error('[member-id] could not assign a member ID', error)
    }
  }
  return assigned
}
