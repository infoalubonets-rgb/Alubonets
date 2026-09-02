export const LOAN_GUARANTOR_LIMITS = {
  fullName: { min: 3, max: 80, minWords: 2, maxWords: 4, wordMax: 30 },
  idNumber: { min: 4, max: 10 },
  phone: { min: 10, max: 17 },
  kraPin: { max: 11 },
  residence: { min: 3, max: 80 },
  relationship: { min: 2, max: 30, maxWords: 3 },
  purpose: { min: 10, max: 500 },
  installmentNotes: { min: 10, max: 500 },
} as const

export type ExternalGuarantorField =
  | 'fullName'
  | 'idNumber'
  | 'phone'
  | 'residence'
  | 'relationship'
  | 'kraPin'

export function fieldLabelForGuarantorField(field: ExternalGuarantorField) {
  switch (field) {
    case 'fullName':
      return 'Full legal name'
    case 'idNumber':
      return 'ID number'
    case 'phone':
      return 'Phone number'
    case 'residence':
      return 'Place of residence'
    case 'relationship':
      return 'Relationship to applicant'
    case 'kraPin':
      return 'KRA PIN'
    default:
      return 'Field'
  }
}
