export const ACTION_LABELS: Record<string, string> = {
  MEMBER_APPROVE: 'Approved a member',
  MEMBER_REJECT: 'Rejected a member',
  MEMBER_ROLE_CHANGE: 'Changed a member’s role',
  MEMBER_DASHBOARD_ACCESS: 'Updated dashboard access',
  MEMBER_SUSPEND: 'Suspended a member',
  MEMBER_STATUS_CHANGE: 'Restored a member',
  SUPER_ADMIN_FLAG: 'Updated Super Admin access',
  PROFILE_UPDATE: 'Updated their profile',
  CONTRIBUTION_CREATE: 'Recorded a contribution',
  CONTRIBUTION_CSV_IMPORT: 'Imported contributions (CSV)',
  WELFARE_REVIEW: 'Reviewed a welfare request',
  MEETING_CREATE: 'Created a meeting',
  MEETING_UPDATE: 'Updated a meeting',
  MEETING_PUBLISH: 'Published meeting minutes',
  MPESA_STK_INIT: 'Started an M-Pesa payment',
  ANNOUNCEMENT_SEND: 'Sent an announcement',
  CONTACT_MESSAGE_READ: 'Marked a contact message as read',
  CONTACT_MESSAGE_DELETE: 'Deleted a contact message',
  SEED: 'Seeded the database',
}

export function formatAuditAction(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  )
}

export function formatAuditMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const m = meta as Record<string, unknown>
  const parts: string[] = []
  if (typeof m.role === 'string') parts.push(`role: ${m.role}`)
  if (typeof m.status === 'string') parts.push(`status: ${m.status}`)
  if (typeof m.isSuperAdmin === 'boolean') parts.push(m.isSuperAdmin ? 'granted' : 'revoked')
  if (Array.isArray(m.dashboardAccess)) parts.push(`${m.dashboardAccess.length} dashboards`)
  if (typeof m.created === 'number') parts.push(`${m.created} rows`)
  if (typeof m.amount === 'number') parts.push(`KES ${m.amount}`)
  if (typeof m.checkoutRequestId === 'string') parts.push('STK')
  if (typeof m.documentId === 'string') parts.push('PDF published')
  return parts.length ? parts.join(' · ') : null
}
