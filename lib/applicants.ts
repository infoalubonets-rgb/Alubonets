import type { Prisma } from '@prisma/client'

/**
 * Applicants an administrator can actually review: pending, not rejected, and not a sign-in that
 * never submitted the application (e.g. a first "Continue with Google" that stopped at the form —
 * those have a login but no consent record). Every pending count and list uses this, so the
 * Approvals badge always matches what the Approvals page shows.
 */
export const REVIEWABLE_APPLICANTS: Prisma.UserWhereInput = {
  status: 'PENDING',
  rejectedAt: null,
  NOT: { AND: [{ authUserId: { not: null } }, { consentRecords: { none: {} } }] },
}
