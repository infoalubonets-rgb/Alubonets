import { getAccountProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { canRecordContributions } from '@/lib/finance-access'

export async function requireContributionRecorder() {
  const session = await getAccountProfile()
  if (!session) throw new Error('Sign in to record contributions.')
  const actor = await prisma.user.findUniqueOrThrow({ where: { id: session.id } })
  if (actor.status !== 'ACTIVE' || !canRecordContributions(actor)) throw new Error('Only Treasurer and Super Admin accounts can record contributions.')
  return actor
}
