import type { Document, Role } from '@prisma/client'

export function canReadDocument(document: Pick<Document, 'accessLevel' | 'allowedRoles' | 'status' | 'expiresAt'>, role: Role) {
  if (document.status !== 'PUBLISHED') return role === 'ADMIN' || role === 'SECRETARY'
  if (document.expiresAt && document.expiresAt < new Date()) return role === 'ADMIN' || role === 'SECRETARY'
  if (document.accessLevel === 'PUBLIC' || document.accessLevel === 'MEMBERS') return true
  if (document.accessLevel === 'ADMIN_SECRETARY') return role === 'ADMIN' || role === 'SECRETARY'
  return document.allowedRoles.includes(role) || role === 'ADMIN' || role === 'SECRETARY'
}

