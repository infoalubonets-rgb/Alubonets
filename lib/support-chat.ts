import type { Role } from '@prisma/client'

export const SUPPORT_RESPONDER_ROLES: Role[] = ['ADMIN', 'EXECUTIVE']

/** Who answers member support chats: Admins, Super Admins and Executives. */
export function isSupportResponder(actor: { role: Role | string; isSuperAdmin?: boolean | null }) {
  return Boolean(actor.isSuperAdmin) || SUPPORT_RESPONDER_ROLES.includes(actor.role as Role)
}
