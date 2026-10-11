type PublicExecutive = {
  publicProfileFields: string[]
  email: string
  phone: string | null
  location: string | null
  memberProfile: { profession: string | null; skills?: string | null; educationLevel?: string | null; achievements?: string | null; mentorshipArea?: string | null; interests?: string | null } | null
}

/** Only approved fields leave the server, even when the visitor has not expanded More. */
const DETAIL_FIELDS = [
  { key: 'profession', label: 'Profession', read: (u: PublicExecutive) => u.memberProfile?.profession },
  { key: 'location', label: 'Location', read: (u: PublicExecutive) => u.location },
  { key: 'email', label: 'Email', read: (u: PublicExecutive) => u.email },
  { key: 'phone', label: 'Phone', read: (u: PublicExecutive) => u.phone },
  { key: 'skills', label: 'Skills', read: (u: PublicExecutive) => u.memberProfile?.skills },
  { key: 'educationLevel', label: 'Education', read: (u: PublicExecutive) => u.memberProfile?.educationLevel?.replaceAll('_', ' ') },
  { key: 'achievements', label: 'Achievements', read: (u: PublicExecutive) => u.memberProfile?.achievements },
  { key: 'mentorshipArea', label: 'Mentorship', read: (u: PublicExecutive) => u.memberProfile?.mentorshipArea },
  { key: 'interests', label: 'Interests', read: (u: PublicExecutive) => u.memberProfile?.interests },
] as const

export type PublicDetail = { label: string; value: string }

export function executivePublicExtras(user: PublicExecutive, profile: { biography: string; responsibilities: string | null } | undefined): {
  details: PublicDetail[]
  biography: string
  responsibilities: string[]
} {
  const allowed = new Set(user.publicProfileFields)
  if (!allowed.has('more')) return { details: [], biography: '', responsibilities: [] }
  return {
    // Labelled so visitors can tell a location from an interest; empty fields are skipped.
    details: DETAIL_FIELDS.filter((f) => allowed.has(f.key))
      .map((f) => ({ label: f.label, value: f.read(user)?.trim() ?? '' }))
      .filter((d) => d.value),
    biography: allowed.has('biography') ? profile?.biography?.trim() || '' : '',
    responsibilities: allowed.has('responsibilities') ? (profile?.responsibilities || '').split('\n').map(line => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean) : [],
  }
}
