type FinanceViewer = { role: string; isSuperAdmin?: boolean | null; dashboardAccess?: readonly string[] | null }

/**
 * Only the Treasurer records money (payments in, expenses and disbursements out) or proposes a
 * reversal. Admin and Super Admin can see everything but deliberately cannot do either; a member
 * whose second role is Treasurer can.
 */
export function canRecordPayments(viewer: FinanceViewer) {
  if (viewer.role === 'TREASURER') return true
  if (viewer.role === 'ADMIN' || viewer.isSuperAdmin) return false
  return Boolean(viewer.dashboardAccess?.includes('TREASURER'))
}

/**
 * Who may see every member's contributions: Admin and Super Admin, the Treasurer (or anyone
 * given Treasurer access), and the read-only Auditor. Everyone else sees only their own and,
 * for a Principal Member, their branch's.
 */
export function canViewAllFinances(viewer: FinanceViewer) {
  return (
    viewer.role === 'ADMIN' ||
    viewer.role === 'TREASURER' ||
    viewer.role === 'AUDITOR' ||
    Boolean(viewer.isSuperAdmin) ||
    Boolean(viewer.dashboardAccess?.includes('TREASURER'))
  )
}
