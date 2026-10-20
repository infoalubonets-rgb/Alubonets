/**
 * Family tags. Each Principal Member has a family code: P + first-name initial + surname initial
 * (John Wekesa → PJW). When two Principals share initials, the later one gets a number (PJW2).
 * Members attached to a Principal are numbered in the order they joined: PJW01, PJW02… (PJW2-01
 * for a numbered code, so the digits never run together).
 *
 * The database assigns codes and numbers (trigger `users_assign_family_tags`), so every code
 * path that creates a Principal or attaches a member gets them. A code never changes once given,
 * even if the Principal's name is edited.
 */

type TaggableMember = {
  isPrincipal: boolean
  familyCode: string | null
  familyMemberNumber: number | null
  principal?: { familyCode: string | null } | null
}

/** The tag shown for a member: PJW for a Principal, PJW01 for someone attached, null otherwise. */
export function familyTag(member: TaggableMember) {
  if (member.isPrincipal && member.familyCode) return member.familyCode
  const code = member.principal?.familyCode
  if (!code || !member.familyMemberNumber) return null
  const number = String(member.familyMemberNumber).padStart(2, '0')
  return /\d$/.test(code) ? `${code}-${number}` : `${code}${number}`
}
