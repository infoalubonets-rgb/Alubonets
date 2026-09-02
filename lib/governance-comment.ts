import { z } from 'zod'
import { GOVERNANCE_COMMENT_MAX } from '@/lib/governance-categories'

const UNSAFE_GOVERNANCE_TEXT_PATTERNS = [
  /<script\b/i,
  /<\/script>/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*link\b/i,
  /<\s*meta\b/i,
  /<\s*style\b/i,
  /javascript:/i,
  /data:text\/html/i,
  /\bon\w+\s*=/i,
  /\beval\s*\(/i,
  /\bdocument\.(cookie|write|domain)\b/i,
  /\bwindow\.(location|open)\b/i,
  /(\bunion\b[\s\S]{0,40}\bselect\b)/i,
  /(\bdrop\b[\s\S]{0,40}\btable\b)/i,
  /(\bdelete\b[\s\S]{0,40}\bfrom\b)/i,
  /(\binsert\b[\s\S]{0,40}\binto\b)/i,
  /(\bupdate\b[\s\S]{0,40}\bset\b)/i,
  /;\s*--/,
  /'\s*;\s*/i,
  /<\?/,
  /\{\{.*\}\}/,
]

export function containsUnsafeGovernanceText(value: string) {
  return UNSAFE_GOVERNANCE_TEXT_PATTERNS.some((pattern) => pattern.test(value))
}

export function governanceCommentRemaining(length: number) {
  return Math.max(0, GOVERNANCE_COMMENT_MAX - length)
}

export function validateGovernanceCommentText(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > GOVERNANCE_COMMENT_MAX) {
    return `Comment must be ${GOVERNANCE_COMMENT_MAX} characters or fewer (about 4 lines).`
  }
  if (containsUnsafeGovernanceText(trimmed)) {
    return 'Remove HTML, code, or script-like text from your comment.'
  }
  return null
}

export const governanceCommentSchema = z
  .string()
  .trim()
  .max(GOVERNANCE_COMMENT_MAX, `Comment must be ${GOVERNANCE_COMMENT_MAX} characters or fewer (about 4 lines).`)
  .refine((value) => !value || !containsUnsafeGovernanceText(value), {
    message: 'Remove HTML, code, or script-like text from your comment.',
  })
