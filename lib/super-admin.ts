export type SuperAdminGrant = { id: string; superAdminGrantedById: string | null }

export function grantMap(rows: SuperAdminGrant[]): Map<string, string | null> {
  return new Map(rows.map((r) => [r.id, r.superAdminGrantedById]))
}

/**
 * A Super Admin can only be removed by the Super Admin who granted it, or by anyone
 * above that person in the chain of grants. Founding Super Admins (no granter) and
 * yourself can never be removed this way.
 */
export function canRemoveSuperAdmin(
  actorId: string,
  targetId: string,
  grantedBy: Map<string, string | null>,
): boolean {
  if (actorId === targetId) return false
  const seen = new Set<string>([targetId])
  let current = grantedBy.get(targetId) ?? null
  while (current && !seen.has(current)) {
    if (current === actorId) return true
    seen.add(current)
    current = grantedBy.get(current) ?? null
  }
  return false
}
