/**
 * Removes a test account by email, including a test Super Admin (which the app's Delete member
 * button refuses). Uses the same deletion as the app: the account's contributions are reversed
 * and audited, then the account is deleted, or wiped if locked ledger records still point at it.
 * Audit logs are never deleted.
 *
 * Dry run (shows what would be removed, changes nothing):
 *   node --env-file=.env.local --import tsx scripts/remove-test-account.ts --email test@example.com --actor you@example.com
 * Remove it:
 *   node --env-file=.env.local --import tsx scripts/remove-test-account.ts --email test@example.com --actor you@example.com --confirm
 *
 * --actor is the Super Admin recorded in the audit log as having removed the account.
 */
import { prisma } from '../lib/prisma'
import { deleteOneMember } from '../lib/member-deletion'

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? process.argv[index + 1]?.trim().toLowerCase() : undefined
}

async function main() {
  const email = arg('email')
  const actorEmail = arg('actor')
  const confirm = process.argv.includes('--confirm')
  if (!email || !actorEmail) throw new Error('Pass --email <test account> and --actor <your Super Admin email>.')
  if (email === actorEmail) throw new Error('The account to remove and the actor must be different.')

  const [target, actor] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: {
        id: true, fullName: true, email: true, role: true, status: true, isSuperAdmin: true, membershipNumber: true, createdAt: true,
        _count: { select: { contributions: true, attachedMembers: true, createdFinancialTransactions: true, approvedFinancialTransactions: true, auditLogs: true } },
      },
    }),
    prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true, fullName: true, role: true, isSuperAdmin: true, status: true } }),
  ])
  if (!target) throw new Error(`No account with email ${email}.`)
  if (!actor || !actor.isSuperAdmin || actor.status !== 'ACTIVE') throw new Error(`${actorEmail} is not an active Super Admin.`)

  console.log('Account to remove:')
  console.log(`  ${target.fullName} <${target.email}> · ${target.isSuperAdmin ? 'Super Admin' : target.role} · ${target.status} · member ID ${target.membershipNumber ?? 'none'} · created ${target.createdAt.toISOString().slice(0, 10)}`)
  console.log(`  contributions ${target._count.contributions} · attached members ${target._count.attachedMembers} · ledger entries recorded ${target._count.createdFinancialTransactions} · approved ${target._count.approvedFinancialTransactions} · audit entries ${target._count.auditLogs} (kept)`)
  console.log(`Removed by: ${actor.fullName} (${actorEmail})`)

  if (!confirm) {
    console.log('\nDry run only. Nothing changed. Add --confirm to remove the account.')
    return
  }
  const result = await deleteOneMember(actor, target.id, { allowSuperAdmin: true })
  if (!result.ok) throw new Error(result.error)
  const after = await prisma.user.findUnique({ where: { id: target.id }, select: { fullName: true, email: true } })
  console.log(after ? `\nDone: account wiped (now "${after.fullName}", hidden from all lists).` : '\nDone: account permanently deleted.')
}

main()
  .catch((error) => {
    console.error(`Failed: ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
