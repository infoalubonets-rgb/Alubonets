import { z } from 'zod'

/** The largest single money value any form accepts, in KES. */
export const MAX_AMOUNT_KES = 999_999

const tooLarge = (label: string) => `${label} cannot be more than KES 999,999.`

/** A required amount: more than zero and at most KES 999,999. */
export function amountKes(label = 'Amount') {
  return z.coerce
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a number.`)
    .positive(`${label} must be more than zero.`)
    .max(MAX_AMOUNT_KES, tooLarge(label))
}

/** An amount that may be zero (budgets, fees), still capped at KES 999,999. */
export function amountKesOrZero(label = 'Amount') {
  return z.coerce
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a number.`)
    .min(0, `${label} cannot be negative.`)
    .max(MAX_AMOUNT_KES, tooLarge(label))
}

/** Client-side check matching `amountKes`; returns an error message or null. */
export function amountError(value: FormDataEntryValue | string | null | undefined, label = 'Amount') {
  const text = String(value ?? '').trim()
  if (!text) return `Enter the ${label.toLowerCase()}.`
  const amount = Number(text)
  if (!Number.isFinite(amount)) return `${label} must be a number.`
  if (amount <= 0) return `${label} must be more than zero.`
  if (amount > MAX_AMOUNT_KES) return tooLarge(label)
  return null
}
