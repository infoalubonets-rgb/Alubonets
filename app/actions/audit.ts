'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/session'

/** Routine audit deletion is disabled. Retention is handled by /api/cron/purge-audit only. */
export async function deleteAuditRecord(formData: FormData) {
  await requireAdmin()
  z.string().min(1).parse(formData.get('id'))
  z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  throw new Error(
    'Audit records cannot be deleted from the admin UI. Aged records are removed only by the controlled retention purge.',
  )
}
