/** Age in full years on a given date (UTC). */
export function ageOn(dateOfBirth: Date, on = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const beforeBirthday =
    on.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() < dateOfBirth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}
