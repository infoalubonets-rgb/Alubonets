'use client'

import { useState } from 'react'
import { GOVERNANCE_COMMENT_MAX } from '@/lib/governance-categories'
import { governanceCommentRemaining, validateGovernanceCommentText } from '@/lib/governance-comment'

type Props = {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (message: string | null) => void
  id?: string
  placeholder?: string
  disabled?: boolean
}

export default function GovernanceCommentField({
  value,
  onChange,
  onValidationChange,
  id = 'governance-comment',
  placeholder = 'Optional comment for the group…',
  disabled = false,
}: Props) {
  const [focused, setFocused] = useState(false)
  const remaining = governanceCommentRemaining(value.length)
  const atLimit = remaining === 0
  const showCounter = focused || value.length > 0
  const validationError = validateGovernanceCommentText(value)

  function handleChange(next: string) {
    if (disabled) return
    onChange(next.slice(0, GOVERNANCE_COMMENT_MAX))
    onValidationChange?.(validateGovernanceCommentText(next.slice(0, GOVERNANCE_COMMENT_MAX)))
  }

  return (
    <div
      className={`mt-3 rounded-xl border p-3 transition-colors ${
        atLimit
          ? 'border-error bg-error/5'
          : validationError
            ? 'border-error/60 bg-surface-container-lowest'
            : 'border-transparent bg-transparent p-0'
      }`}
    >
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onValidationChange?.(validateGovernanceCommentText(value))
        }}
        maxLength={GOVERNANCE_COMMENT_MAX}
        rows={4}
        placeholder={placeholder}
        aria-invalid={atLimit || Boolean(validationError)}
        aria-describedby={`${id}-counter`}
        className={`w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70 ${
          atLimit
            ? 'border-error text-on-surface focus:ring-error/20'
            : validationError
              ? 'border-error/70 focus:ring-error/15'
              : 'border-outline-variant focus:ring-primary/10'
        }`}
      />
      {showCounter && (
        <p
          id={`${id}-counter`}
          className={`mt-1.5 text-right text-[11px] font-semibold tabular-nums ${
            atLimit ? 'text-error' : remaining <= 40 ? 'text-amber-700' : 'text-on-surface-variant'
          }`}
        >
          {remaining} {remaining === 1 ? 'character' : 'characters'} left
        </p>
      )}
      {validationError && value.trim().length > 0 && (
        <p className="mt-1 text-[11px] font-semibold text-error">{validationError}</p>
      )}
    </div>
  )
}
