import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { createServerClient } from '@/lib/supabase-server'
import { canRecordContributions } from '@/lib/finance-access'
import { reverseContributions } from '@/lib/contribution-deletion'
import { DELETED_MEMBER_NAME, deletedMemberEmail, isDeletedMemberEmail } from '@/lib/deleted-member'

export type DeleteActor = { id: string; role: string; isSuperAdmin?: boolean | null }

/** True when the error is a locked record (ledger row, minutes, documents…) still pointing at the member. */
function isKeptRecordError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = error instanceof Error ? error.message : ''
  return code === 'P2003' || code === 'P2014' || /foreign key|immutable|cannot be deleted|append-only/i.test(message)
}

/**
 * Deletes one member for an authorised admin. Their contributions are deleted first (reversed in
 * the ledger, audited). The account is then removed outright; if locked records the system must
 * keep (ledger entries, minutes, documents…) still point at it, the account is wiped instead:
 * every personal detail cleared, sign-in removed, renamed "Deleted member" and hidden from lists.
 */
export async function deleteOneMember(actor: DeleteActor, userId: string, options: { allowSuperAdmin?: boolean } = {}): Promise<{ ok: true; fullName: string } | { ok: false; error: string }> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, fullName: true, email: true, role: true, status: true, isSuperAdmin: true, authUserId: true, membershipNumber: true,
      _count: { select: { attachedMembers: true } },
    },
  })
  if (!target || isDeletedMemberEmail(target.email)) return { ok: false, error: 'This member no longer exists.' }
  const name = target.fullName
  if (target.id === actor.id) return { ok: false, error: 'You cannot delete your own account.' }
  if (target.isSuperAdmin && !options.allowSuperAdmin) return { ok: false, error: `${name} is a Super Admin. Remove their Super Admin rights first.` }
  if (target.role === 'ADMIN' && !actor.isSuperAdmin) return { ok: false, error: `Only a Super Admin can delete an Admin (${name}).` }
  if (target._count.attachedMembers > 0) {
    return { ok: false, error: `${name} has ${target._count.attachedMembers} attached member(s). Move or delete them first.` }
  }

  const payments = await prisma.contribution.findMany({ where: { userId, status: { not: 'REVERSED' } }, select: { id: true } })
  if (payments.length > 0 && !canRecordContributions(actor)) {
    return { ok: false, error: `${name} has recorded payments. Only the Treasurer or a Super Admin can delete a member with payments.` }
  }
  const deletedPayments = payments.length ? await reverseContributions(actor.id, payments.map((p) => p.id), `Member ${name} deleted`) : 0

  let mode: 'deleted' | 'wiped' = 'deleted'
  try {
    await prisma.$transaction(async (tx) => {
      // Children that block the delete (ON DELETE RESTRICT) but belong only to this member.
      await tx.supportingDocument.deleteMany({ where: { OR: [{ uploadedById: userId, transactionId: null }, { contribution: { userId } }] } })
      await tx.supportMessage.deleteMany({ where: { senderId: userId } })
      await tx.familyAccountTransition.deleteMany({ where: { memberId: userId } })
      await tx.familyBranchHistory.deleteMany({ where: { memberId: userId } })
      await tx.user.delete({ where: { id: userId } })
    })
  } catch (error) {
    if (!isKeptRecordError(error)) throw error
    mode = 'wiped'
    await prisma.$transaction(async (tx) => {
      await tx.memberProfile.deleteMany({ where: { userId } })
      await tx.userNotification.deleteMany({ where: { userId } })
      await tx.passwordResetToken.deleteMany({ where: { userId } })
      await tx.consentRecord.deleteMany({ where: { userId } })
      await tx.profileVisibility.deleteMany({ where: { userId } })
      await tx.familyInvite.deleteMany({ where: { userId } })
      await tx.supportConversation.deleteMany({ where: { userId } })
      await tx.loginEvent.updateMany({ where: { userId }, data: { userId: null } })
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: DELETED_MEMBER_NAME,
          email: deletedMemberEmail(userId),
          authUserId: null,
          phone: null,
          location: null,
          avatarUrl: null,
          membershipNumber: null,
          legacyMembershipNumber: null,
          familyCode: null,
          isPrincipal: false,
          principalMemberId: null,
          familyRelationship: null,
          role: 'MEMBER',
          isSuperAdmin: false,
          superAdminGrantedById: null,
          dashboardAccess: [],
          status: 'INACTIVE',
          approvalNotes: null,
          rejectionReason: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodes: null,
          standingReason: null,
          standingOverride: null,
          standingOverrideUntil: null,
          contributionPlan: null,
          publicProfileFields: [],
          showOnAbout: false,
          aboutTitle: null,
        },
      })
    }, { timeout: 20_000 })
  }

  await writeAudit({
    userId: actor.id,
    action: 'MEMBER_DELETE',
    entity: 'User',
    entityId: userId,
    reason: mode === 'deleted'
      ? `Member ${name} permanently deleted`
      : `Member ${name} deleted: personal details wiped (account kept only because locked ledger records point at it)`,
    oldValue: { fullName: name, email: target.email, membershipNumber: target.membershipNumber, status: target.status, role: target.role },
    meta: { deletedMember: name, deletedEmail: target.email, mode, deletedPayments },
  })
  if (target.authUserId) {
    const { error } = await createServerClient().auth.admin.deleteUser(target.authUserId)
    if (error) console.error('Could not delete Supabase user of deleted member', error)
  }
  return { ok: true, fullName: name }
}
