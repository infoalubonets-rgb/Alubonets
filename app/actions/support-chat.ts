'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { sendSupportMessageEmail } from '@/lib/email/resend'
import { logError } from '@/lib/logger'
import { writeAudit } from '@/lib/audit'

const messageSchema = z.object({ conversationId: z.string().optional(), body: z.string().trim().min(1).max(4000) })
export async function sendSupportMessage(input: z.infer<typeof messageSchema>) {
  const actor = await requireActiveRole()
  const data = messageSchema.parse(input)
  const isAdmin = actor.isSuperAdmin || actor.role === 'ADMIN'
  let conversation
  if (isAdmin && data.conversationId) {
    conversation = await prisma.supportConversation.findUnique({ where: { id: data.conversationId }, include: { user: true } })
    if (!conversation) throw new Error('Conversation not found')
  } else {
    conversation = await prisma.supportConversation.upsert({ where: { userId: actor.id }, create: { userId: actor.id }, update: { closedAt: null }, include: { user: true } })
  }
  await prisma.supportMessage.create({ data: { conversationId: conversation.id, senderId: actor.id, body: data.body, ...(isAdmin ? { readByAdminAt: new Date() } : { readByMemberAt: new Date() }) } })
  if (!isAdmin) sendSupportMessageEmail({ memberName: actor.fullName, memberEmail: actor.email, body: data.body }).catch((e) => logError('support.email.failed', e))
  revalidatePath('/support-chat')
  return { ok: true }
}

export async function markSupportConversationRead(conversationId: string) {
  const actor = await requireActiveRole()
  const isAdmin = actor.isSuperAdmin || actor.role === 'ADMIN'
  await prisma.supportMessage.updateMany({ where: { conversationId, ...(isAdmin ? { senderId: { not: actor.id }, readByAdminAt: null } : { senderId: { not: actor.id }, readByMemberAt: null }) }, data: isAdmin ? { readByAdminAt: new Date() } : { readByMemberAt: new Date() } })
  revalidatePath('/support-chat')
}

export async function deleteSupportConversation(conversationId: string) {
  const actor = await requireActiveRole()
  if (!actor.isSuperAdmin && actor.role !== 'ADMIN') {
    throw new Error('Only an administrator can delete a conversation')
  }
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: { user: { select: { fullName: true } } },
  })
  if (!conversation) throw new Error('Conversation not found')

  await prisma.supportConversation.delete({ where: { id: conversationId } })
  await writeAudit({
    userId: actor.id,
    action: 'SUPPORT_CONVERSATION_DELETE',
    entity: 'SupportConversation',
    entityId: conversationId,
    reason: `Deleted support conversation with ${conversation.user.fullName}`,
  })
  revalidatePath('/support-chat')
  return { ok: true as const }
}
