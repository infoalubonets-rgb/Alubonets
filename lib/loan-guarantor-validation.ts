import { z } from 'zod'
import { LOAN_GUARANTOR_LIMITS } from '@/lib/loan-guarantor-limits'
import { amountKes } from '@/lib/money-limits'

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean)
}

const fullNamePattern = /^[\p{L}][\p{L}' -]*[\p{L}]$/u
const singleNamePattern = /^[\p{L}]{2,}$/u
const idNumberPattern = /^[A-Za-z0-9-]+$/
const phonePattern = /^(?:\+254|254|0)(?:7|1)[0-9]{8}$/
const residencePattern = /^[\p{L}\p{N}][\p{L}\p{N}'., /()-]{2,79}$/u
const relationshipPattern = /^[\p{L}][\p{L}' -]*$/u
const kraPinPattern = /^[AP][0-9]{9}[A-Z]$/

export const guarantorFullNameSchema = z
  .string()
  .trim()
  .min(LOAN_GUARANTOR_LIMITS.fullName.min, 'Full name must be at least 3 characters.')
  .max(LOAN_GUARANTOR_LIMITS.fullName.max, `Full name must be ${LOAN_GUARANTOR_LIMITS.fullName.max} characters or fewer.`)
  .refine((value) => fullNamePattern.test(value) || singleNamePattern.test(value), {
    message: 'Use only letters, spaces, hyphens or apostrophes.',
  })
  .refine((value) => {
    const parts = words(value)
    return parts.length >= LOAN_GUARANTOR_LIMITS.fullName.minWords && parts.length <= LOAN_GUARANTOR_LIMITS.fullName.maxWords
  }, {
    message: `Enter first and last name (${LOAN_GUARANTOR_LIMITS.fullName.minWords}–${LOAN_GUARANTOR_LIMITS.fullName.maxWords} words).`,
  })
  .refine(
    (value) => words(value).every((part) => part.length >= 2 && part.length <= LOAN_GUARANTOR_LIMITS.fullName.wordMax),
    { message: `Each name part must be 2–${LOAN_GUARANTOR_LIMITS.fullName.wordMax} letters.` },
  )

export const guarantorIdNumberSchema = z
  .string()
  .trim()
  .min(LOAN_GUARANTOR_LIMITS.idNumber.min, 'ID number must be at least 4 characters.')
  .max(LOAN_GUARANTOR_LIMITS.idNumber.max, `ID number must be ${LOAN_GUARANTOR_LIMITS.idNumber.max} characters or fewer.`)
  .refine((value) => idNumberPattern.test(value), {
    message: 'ID number may only contain letters, numbers or hyphens.',
  })

export const guarantorPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(
    z
      .string()
      .min(LOAN_GUARANTOR_LIMITS.phone.min, 'Enter a valid Kenyan mobile number.')
      .max(LOAN_GUARANTOR_LIMITS.phone.max)
      .refine((value) => phonePattern.test(value), {
        message: 'Enter a valid Kenyan mobile number, e.g. 0712345678.',
      }),
  )

export const guarantorResidenceSchema = z
  .string()
  .trim()
  .min(LOAN_GUARANTOR_LIMITS.residence.min, 'Place of residence must be at least 3 characters.')
  .max(LOAN_GUARANTOR_LIMITS.residence.max, `Place of residence must be ${LOAN_GUARANTOR_LIMITS.residence.max} characters or fewer.`)
  .refine((value) => residencePattern.test(value), {
    message: 'Use letters, numbers and basic punctuation only.',
  })

export const guarantorRelationshipSchema = z
  .string()
  .trim()
  .min(LOAN_GUARANTOR_LIMITS.relationship.min, 'Relationship must be at least 2 characters.')
  .max(LOAN_GUARANTOR_LIMITS.relationship.max, `Relationship must be ${LOAN_GUARANTOR_LIMITS.relationship.max} characters or fewer.`)
  .refine((value) => relationshipPattern.test(value), {
    message: 'Use only letters, spaces, hyphens or apostrophes.',
  })
  .refine((value) => words(value).length <= LOAN_GUARANTOR_LIMITS.relationship.maxWords, {
    message: `Relationship must be ${LOAN_GUARANTOR_LIMITS.relationship.maxWords} words or fewer.`,
  })

export const guarantorKraPinSchema = z
  .string()
  .trim()
  .max(LOAN_GUARANTOR_LIMITS.kraPin.max)
  .transform((value) => value.toUpperCase())
  .refine((value) => value === '' || kraPinPattern.test(value), {
    message: 'Enter a valid KRA PIN such as A123456789B.',
  })

export const externalGuarantorSchema = z.object({
  fullName: guarantorFullNameSchema,
  idNumber: guarantorIdNumberSchema,
  phone: guarantorPhoneSchema,
  residence: guarantorResidenceSchema,
  relationship: guarantorRelationshipSchema,
  kraPin: guarantorKraPinSchema.optional().transform((value) => value || null),
})

export const loanApplicationBodySchema = z.object({
  amountKes: amountKes('Loan amount'),
  purpose: z.string().trim().min(LOAN_GUARANTOR_LIMITS.purpose.min).max(LOAN_GUARANTOR_LIMITS.purpose.max),
  dueAt: z.coerce.date(),
  installmentNotes: z.string().trim().min(LOAN_GUARANTOR_LIMITS.installmentNotes.min).max(LOAN_GUARANTOR_LIMITS.installmentNotes.max),
  notes: z.string().trim().max(500).optional(),
})

export type ExternalGuarantorInput = z.infer<typeof externalGuarantorSchema>

export function parseExternalGuarantor(input: {
  fullName: string
  idNumber: string
  phone: string
  residence: string
  relationship: string
  kraPin?: string | null
}) {
  return externalGuarantorSchema.parse({
    ...input,
    kraPin: input.kraPin ?? '',
  })
}

export function parseExternalGuarantorsFromForm(formData: FormData) {
  const externalFields = {
    names: formData.getAll('externalGuarantorName').map((value) => String(value)),
    ids: formData.getAll('externalGuarantorIdNumber').map((value) => String(value)),
    phones: formData.getAll('externalGuarantorPhone').map((value) => String(value)),
    residences: formData.getAll('externalGuarantorResidence').map((value) => String(value)),
    relationships: formData.getAll('externalGuarantorRelationship').map((value) => String(value)),
    kraPins: formData.getAll('externalGuarantorKraPin').map((value) => String(value)),
  }
  const externalRowCount = Math.max(0, ...Object.values(externalFields).map((values) => values.length))
  const rows = Array.from({ length: externalRowCount }, (_, index) => ({
    fullName: externalFields.names[index] || '',
    idNumber: externalFields.ids[index] || '',
    phone: externalFields.phones[index] || '',
    residence: externalFields.residences[index] || '',
    relationship: externalFields.relationships[index] || '',
    kraPin: externalFields.kraPins[index] || '',
  })).filter((guarantor) => Object.values(guarantor).some((value) => String(value).trim()))

  return rows.map((row) => parseExternalGuarantor(row))
}
