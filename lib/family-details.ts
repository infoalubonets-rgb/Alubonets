export type FamilyDetailMember = {
  id: string
  fullName: string
  email: string
  relationship: string | null
  status: string
  registrationState: string
  isYou?: boolean
  isPrincipal?: boolean
  phone?: string | null
  location?: string | null
  details?: [string, string][]
}

export function familyDetailView(member: FamilyDetailMember, relationshipToPrincipal: string | null) {
  if (member.isPrincipal && !member.isYou) {
    return {
      title: 'My Principal Member',
      description: 'Read-only Principal Member information.',
      fields: [
        ['Name', member.fullName],
        ['Location', member.location || 'Not provided'],
        ['Phone', member.phone || 'Not provided'],
        ['Your relationship to this Principal', relationshipToPrincipal || 'Not specified'],
      ] as [string, string][],
    }
  }
  return {
    title: member.isYou ? 'My details' : 'Attached member details',
    description: !member.isYou && member.details
      ? 'Read-only information for a member attached to your branch.'
      : 'Read-only member information.',
    fields: [
      ['Relationship', member.isPrincipal ? 'Principal Member' : member.relationship || 'Family member'],
      ['Email', member.email],
      ['Phone', member.phone || 'Not provided'],
      ['Membership status', member.status],
      ['Registration state', member.registrationState.replaceAll('_', ' ')],
      ...(member.details ?? []),
    ] as [string, string][],
  }
}

/** The signed-in person is never an attached member of their own account. */
export function familyMemberList(members: FamilyDetailMember[]) {
  const principal = members.find(member => member.isPrincipal && !member.isYou)
  const attached = members.filter(member => !member.isYou && member.id !== principal?.id)
  return { principal, attached }
}
