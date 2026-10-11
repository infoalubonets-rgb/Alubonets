type PublicExecutive = {
  publicProfileFields: string[]
  email: string
  phone: string | null
  location: string | null
  memberProfile: { profession: string | null; skills?: string | null; educationLevel?: string | null; achievements?: string | null; mentorshipArea?: string | null; interests?: string | null } | null
}

/** Only approved fields leave the server, even when the visitor has not expanded More. */
export function executivePublicExtras(user: PublicExecutive, profile: { biography: string; responsibilities: string | null } | undefined) {
  const allowed = new Set(user.publicProfileFields)
  if (!allowed.has('more')) return { details: [], biography: '', responsibilities: [] }
  return {
    details: [allowed.has('profession') ? user.memberProfile?.profession : null, allowed.has('location') ? user.location : null, allowed.has('email') ? user.email : null, allowed.has('phone') ? user.phone : null,
      ...(['skills', 'educationLevel', 'achievements', 'mentorshipArea', 'interests'] as const).map(key => allowed.has(key) ? user.memberProfile?.[key]?.replaceAll('_', ' ') : null),
    ].filter((value): value is string => Boolean(value)),
    biography: allowed.has('biography') ? profile?.biography || '' : '',
    responsibilities: allowed.has('responsibilities') ? (profile?.responsibilities || '').split('\n').map(line => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean) : [],
  }
}
