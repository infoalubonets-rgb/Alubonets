/** Details a member should fill in themselves when an administrator created their account. */
type CompletableUser = {
  phone: string | null
  location: string | null
  approvalNotes?: string | null
  memberProfile: {
    gender: string | null
    dateOfBirth: Date | null
    address: string | null
    nextOfKinName: string | null
    nextOfKinPhone: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
  } | null
}

export const ADMIN_CREATED_NOTE = 'Added directly by an administrator'

/** Labels of the important details still empty, in form order. */
export function missingProfileDetails(user: CompletableUser) {
  const p = user.memberProfile
  return [
    ['Phone', user.phone],
    ['Location', user.location],
    ['Gender', p?.gender],
    ['Date of birth', p?.dateOfBirth],
    ['Address', p?.address],
    ['Next of kin', p?.nextOfKinName && p?.nextOfKinPhone],
    ['Emergency contact', p?.emergencyContactName && p?.emergencyContactPhone],
  ]
    .filter(([, value]) => !(typeof value === 'string' ? value.trim() : value))
    .map(([label]) => label as string)
}

/** Admin-created accounts with missing details are sent to My profile after signing in. */
export function needsProfileCompletion(user: CompletableUser) {
  return user.approvalNotes === ADMIN_CREATED_NOTE && missingProfileDetails(user).length > 0
}
