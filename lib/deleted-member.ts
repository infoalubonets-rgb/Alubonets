/**
 * A deleted member who is still referenced by locked ledger records cannot be removed from the
 * database, so their account is wiped instead: personal details cleared, the name set to
 * "Deleted member" and the email replaced with this placeholder. Lists exclude them with
 * NOT_DELETED_MEMBER.
 */
export const DELETED_MEMBER_EMAIL_DOMAIN = '@deleted.invalid'
export const DELETED_MEMBER_NAME = 'Deleted member'

export const deletedMemberEmail = (userId: string) => `deleted-${userId}${DELETED_MEMBER_EMAIL_DOMAIN}`

export const isDeletedMemberEmail = (email: string | null | undefined) => Boolean(email?.endsWith(DELETED_MEMBER_EMAIL_DOMAIN))

/** Prisma `where` fragment for user queries that should skip wiped (deleted) members. */
export const NOT_DELETED_MEMBER = { NOT: { email: { endsWith: DELETED_MEMBER_EMAIL_DOMAIN } } } as const
