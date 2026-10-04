import DashboardShell from '@/components/dashboard/DashboardShell'
import SupportChatClient from '@/components/dashboard/SupportChatClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { isSupportResponder } from '@/lib/support-chat'
export default async function SupportChatPage() {
  const actor = await requireActiveRole()
  const isAdmin = isSupportResponder(actor)
  const canDelete = actor.isSuperAdmin || actor.role === 'ADMIN'
  const conversations = await prisma.supportConversation.findMany({ where: isAdmin ? {} : { userId: actor.id }, orderBy: { updatedAt: 'desc' }, include: { user: { select: { id: true, fullName: true, email: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, fullName: true } } } } } })
  return <DashboardShell role={actor.role} title="Support chat" nav={navForRole(actor.role)} hidePageHeading><SupportChatClient isAdmin={isAdmin} canDelete={canDelete} actorId={actor.id} conversations={conversations.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), closedAt: c.closedAt?.toISOString() || null, messages: c.messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString(), readByAdminAt: m.readByAdminAt?.toISOString() || null, readByMemberAt: m.readByMemberAt?.toISOString() || null })) }))} /></DashboardShell>
}
