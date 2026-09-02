export const GOVERNANCE_CATEGORIES = [
  { value: 'RESOLUTION', label: 'Resolution' },
  { value: 'DECISION', label: 'Decision' },
  { value: 'NOTICE', label: 'Notice' },
  { value: 'POLICY', label: 'Policy' },
] as const

export type GovernanceCategory = (typeof GOVERNANCE_CATEGORIES)[number]['value']

export function governanceCategoryLabel(value: string) {
  return GOVERNANCE_CATEGORIES.find((category) => category.value === value)?.label || value
}

/** ~4 short lines — enough for a paragraph, not an essay. */
export const GOVERNANCE_COMMENT_MAX = 480
