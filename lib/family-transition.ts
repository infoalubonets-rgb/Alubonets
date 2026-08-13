export function ageOn(dateOfBirth: Date, on = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const beforeBirthday = on.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() < dateOfBirth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

export function assertEligibleForAdultInvite(dateOfBirth: Date | null, adulthoodAge: number, on = new Date()) {
  if (!dateOfBirth) throw new Error('A date of birth is required before this member can activate a login')
  const age = ageOn(dateOfBirth, on)
  if (age < adulthoodAge) throw new Error(`This member is ${age}; login activation is available at age ${adulthoodAge}`)
  return age
}
