'use client'

import { type FormEvent, type InvalidEvent, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  externalGuarantorClientSchema,
} from '@/lib/loan-guarantor-validation-client'
import {
  fieldLabelForGuarantorField,
  LOAN_GUARANTOR_LIMITS,
  type ExternalGuarantorField,
} from '@/lib/loan-guarantor-limits'

type MemberOption = { id: string; fullName: string }
type GuarantorRow = { id: number; mode: 'registered' | 'external' | null }

type Props = {
  action: (formData: FormData) => Promise<void>
  minAmount: number
  maxAmount: number
  members: MemberOption[]
  minDueDate: string
  maxDueDate: string
}

/** Marks a compulsory field. Hidden from screen readers, which announce `required` already. */
function Required() {
  return <span aria-hidden="true" className="text-error"> *</span>
}

function Optional() {
  return <span className="font-normal text-on-surface-variant"> (optional)</span>
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition disabled:cursor-wait disabled:opacity-60">
      {pending ? 'Submitting…' : 'Submit application'}
    </button>
  )
}

/** Appends the error/ok border color to a field's base classes, matching the amount field's original convention. */
function fieldClass(hasError: boolean, base: string) {
  return base + ' ' + (hasError ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary')
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} role="alert" className="mt-1 text-[11px] font-semibold text-error">{message}</p>
}

/** Live remaining-character countdown shown only once typing starts; replaces a static "min-max characters" hint. */
function CharCounter({ id, value, min, max }: { id: string; value: string; min: number; max: number }) {
  const remaining = max - value.length
  const belowMin = value.length > 0 && value.length < min
  const nearLimit = value.length > 0 && remaining <= Math.min(20, Math.round(max * 0.1))
  const tone = belowMin || nearLimit ? 'text-error' : 'text-on-surface-variant'
  const message = !value
    ? ''
    : belowMin
      ? `Add ${min - value.length} more character${min - value.length === 1 ? '' : 's'}.`
      : `${remaining} character${remaining === 1 ? '' : 's'} left.`
  return <p id={id} className={'mt-1 text-[11px] font-normal ' + tone}>{message}</p>
}

export default function LoanApplicationForm({ action, minAmount, maxAmount, members, minDueDate, maxDueDate }: Props) {
  const requiredGuarantors = 2
  const [guarantorRows, setGuarantorRows] = useState<GuarantorRow[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [amountKes, setAmountKes] = useState('')
  const [purpose, setPurpose] = useState('')
  const [installmentNotes, setInstallmentNotes] = useState('')
  const effectiveMaxAmount = Math.min(maxAmount, 999_999)
  const guarantorsAdded = guarantorRows.length
  const guarantorsNeeded = Math.max(0, requiredGuarantors - guarantorsAdded)
  const guarantorHint =
    guarantorsAdded > 0 && guarantorsNeeded > 0
      ? `Add guarantor ${guarantorsAdded + 1}`
      : guarantorsAdded > 0 && guarantorsNeeded === 0
        ? `${guarantorsAdded} of ${requiredGuarantors} guarantors added`
        : null
  const addGuarantorLabel =
    guarantorsAdded === 0
      ? 'Add guarantor'
      : guarantorsNeeded > 0
        ? `Add guarantor ${guarantorsAdded + 1}`
        : 'Maximum 2 guarantors added'
  const guarantorSectionRef = useRef<HTMLFieldSetElement | null>(null)
  const lastGuarantorRowRef = useRef<HTMLDivElement | null>(null)
  const previousGuarantorCount = useRef(0)

  useEffect(() => {
    if (guarantorRows.length > previousGuarantorCount.current && lastGuarantorRowRef.current) {
      lastGuarantorRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      lastGuarantorRowRef.current.querySelector<HTMLElement>('button, select, input')?.focus()
    }
    previousGuarantorCount.current = guarantorRows.length
  }, [guarantorRows.length])

  function setFieldError(key: string, message: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: message }))
  }

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function showValidationError(event: InvalidEvent<HTMLFormElement>) {
    event.preventDefault()
    const field = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const label = field.closest('label')?.childNodes[0]?.textContent?.trim() || 'This field'
    const key = field.id || field.name
    setFieldError(key, label + ': ' + field.validationMessage)
    if (field.closest('fieldset') === guarantorSectionRef.current) scrollToGuarantors()
  }

  function scrollToGuarantors() {
    window.requestAnimationFrame(() => {
      guarantorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function validateGuarantors(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    if (!form.checkValidity()) {
      event.preventDefault()
      form.reportValidity()
      return
    }

    const formData = new FormData(form)
    const nextErrors: Record<string, string> = {}
    const requestedAmount = Number(formData.get('amountKes'))
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      event.preventDefault()
      setFieldError('amountKes', 'Enter the amount you need.')
      return
    }
    if (requestedAmount < minAmount) {
      event.preventDefault()
      setFieldError('amountKes', 'Minimum loan amount is KES ' + minAmount.toLocaleString() + '.')
      return
    }
    if (requestedAmount > effectiveMaxAmount) {
      event.preventDefault()
      setFieldError('amountKes', 'Loan limit is KES ' + effectiveMaxAmount.toLocaleString() + '.')
      return
    }
    clearFieldError('amountKes')
    const selectedMemberIds = formData.getAll('guarantorIds').map(String).filter(Boolean)
    const selectedMembers = new Set(selectedMemberIds).size
    const names = formData.getAll('externalGuarantorName').map(String)
    const ids = formData.getAll('externalGuarantorIdNumber').map(String)
    const phones = formData.getAll('externalGuarantorPhone').map(String)
    const residences = formData.getAll('externalGuarantorResidence').map(String)
    const relationships = formData.getAll('externalGuarantorRelationship').map(String)
    const kraPins = formData.getAll('externalGuarantorKraPin').map(String)
    const externalRows = names.map((name, index) => [name, ids[index], phones[index], residences[index], relationships[index]])
    const completedExternal = externalRows.filter((row) => row.every((value) => value?.trim())).length
    const partiallyCompleted = externalRows.some((row) => row.some((value) => value?.trim()) && !row.every((value) => value?.trim()))
    const completedGuarantors = selectedMembers + completedExternal
    if (selectedMembers !== selectedMemberIds.length || partiallyCompleted || completedGuarantors !== requiredGuarantors) {
      event.preventDefault()
      setFormError(selectedMembers !== selectedMemberIds.length ? 'The same registered member cannot be selected more than once.' : partiallyCompleted ? 'Complete every field for each new guarantor. Only the KRA PIN is optional.' : `Exactly ${requiredGuarantors} complete guarantors are required.`)
      scrollToGuarantors()
      return
    }

    const externalRowMeta = guarantorRows.filter((row) => row.mode === 'external')
    externalRowMeta.forEach((row, index) => {
      const parsed = externalGuarantorClientSchema.safeParse({
        fullName: names[index] || '',
        idNumber: ids[index] || '',
        phone: phones[index] || '',
        residence: residences[index] || '',
        relationship: relationships[index] || '',
        kraPin: kraPins[index] || '',
      })
      if (parsed.success) return
      const issue = parsed.error.issues[0]
      const field = String(issue.path[0] || 'fullName')
      const keyMap: Record<string, string> = {
        fullName: `guarantor-${row.id}-name`,
        idNumber: `guarantor-${row.id}-id`,
        phone: `guarantor-${row.id}-phone`,
        residence: `guarantor-${row.id}-residence`,
        relationship: `guarantor-${row.id}-relationship`,
        kraPin: `guarantor-${row.id}-kra`,
      }
      const key = keyMap[field] || `guarantor-${row.id}-name`
      nextErrors[key] = `${fieldLabelForGuarantorField(field as ExternalGuarantorField)}: ${issue.message}`
    })

    if (Object.keys(nextErrors).length > 0) {
      event.preventDefault()
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }))
      setFormError('Fix the highlighted guarantor fields before submitting.')
      scrollToGuarantors()
      return
    }

    setFieldErrors({})
    setFormError('')
  }
  return (
    <form action={action} onSubmit={validateGuarantors} onInvalid={showValidationError} className="grid gap-4 md:grid-cols-2">
      <label className="text-xs font-bold text-on-surface-variant" htmlFor="amountKes">
        Requested amount<Required />
        <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">KES</span>
          <input
            id="amountKes"
            name="amountKes"
            type="text"
            inputMode="decimal"
            required
            value={amountKes}
            pattern="[0-9]{1,6}(?:[.][0-9]{1,2})?"
            placeholder="0"
            title={`Enter KES ${minAmount.toLocaleString()}-${effectiveMaxAmount.toLocaleString()}, using no more than six digits and two decimal places.`}
            aria-invalid={fieldErrors.amountKes ? true : undefined}
            aria-describedby={fieldErrors.amountKes ? 'amountKes-error' : undefined}
            onChange={(event) => {
              const next = event.currentTarget.value
              if (!/^[0-9]{0,6}(?:[.][0-9]{0,2})?$/.test(next)) {
                setFieldError('amountKes', 'Use no more than six digits and two decimal places.')
                return
              }
              const numericAmount = Number(next)
              if (next && numericAmount > effectiveMaxAmount) {
                setFieldError('amountKes', 'Loan limit is KES ' + effectiveMaxAmount.toLocaleString() + '.')
                return
              }
              setAmountKes(next)
              clearFieldError('amountKes')
            }}
            onBlur={(event) => {
              const numericAmount = Number(event.currentTarget.value)
              if (event.currentTarget.value && numericAmount < minAmount) {
                setFieldError('amountKes', 'Minimum loan amount is KES ' + minAmount.toLocaleString() + '.')
              }
            }}
            className={fieldClass(!!fieldErrors.amountKes, 'w-full rounded-xl border bg-surface-container-lowest py-2.5 pl-12 pr-3 text-sm font-normal text-on-surface outline-none transition focus:ring-2 focus:ring-primary/10')}
          />
        </div>
        <FieldError id="amountKes-error" message={fieldErrors.amountKes} />
      </label>
      <label className="text-xs font-bold text-on-surface-variant" htmlFor="dueAt">
        Preferred repayment date<Required />
        <input
          id="dueAt"
          name="dueAt"
          type="date"
          min={minDueDate}
          max={maxDueDate}
          required
          title="Choose a future repayment date within five years."
          aria-invalid={fieldErrors.dueAt ? true : undefined}
          aria-describedby={fieldErrors.dueAt ? 'dueAt-error' : undefined}
          onChange={() => clearFieldError('dueAt')}
          className={fieldClass(!!fieldErrors.dueAt, 'mt-1.5 w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:ring-2 focus:ring-primary/10')}
        />
        <FieldError id="dueAt-error" message={fieldErrors.dueAt} />
      </label>
      <label className="text-xs font-bold text-on-surface-variant md:col-span-2" htmlFor="purpose">
        Purpose of the loan<Required />
        <textarea
          id="purpose"
          name="purpose"
          required
          minLength={LOAN_GUARANTOR_LIMITS.purpose.min}
          maxLength={LOAN_GUARANTOR_LIMITS.purpose.max}
          rows={4}
          value={purpose}
          placeholder="Tell us what the funds will be used for…"
          title="Use 10–500 characters."
          aria-invalid={fieldErrors.purpose ? true : undefined}
          aria-describedby={fieldErrors.purpose ? 'purpose-error' : 'purpose-counter'}
          onChange={(event) => { setPurpose(event.currentTarget.value); clearFieldError('purpose') }}
          className={fieldClass(!!fieldErrors.purpose, 'mt-1.5 w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:ring-2 focus:ring-primary/10')}
        />
        {fieldErrors.purpose
          ? <FieldError id="purpose-error" message={fieldErrors.purpose} />
          : <CharCounter id="purpose-counter" value={purpose} min={LOAN_GUARANTOR_LIMITS.purpose.min} max={LOAN_GUARANTOR_LIMITS.purpose.max} />}
      </label>
      <label className="text-xs font-bold text-on-surface-variant md:col-span-2" htmlFor="installmentNotes">
        Repayment plan<Required />
        <textarea
          id="installmentNotes"
          name="installmentNotes"
          required
          minLength={LOAN_GUARANTOR_LIMITS.installmentNotes.min}
          maxLength={LOAN_GUARANTOR_LIMITS.installmentNotes.max}
          placeholder="For example: KES 5,000 monthly for 6 months"
          title="Use 10-500 characters."
          aria-invalid={fieldErrors.installmentNotes ? true : undefined}
          aria-describedby={fieldErrors.installmentNotes ? 'installmentNotes-error' : 'installmentNotes-counter'}
          onChange={(event) => { setInstallmentNotes(event.currentTarget.value); clearFieldError('installmentNotes') }}
          className={fieldClass(!!fieldErrors.installmentNotes, 'mt-1.5 w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:ring-2 focus:ring-primary/10')}
        />
        {fieldErrors.installmentNotes
          ? <FieldError id="installmentNotes-error" message={fieldErrors.installmentNotes} />
          : <CharCounter id="installmentNotes-counter" value={installmentNotes} min={LOAN_GUARANTOR_LIMITS.installmentNotes.min} max={LOAN_GUARANTOR_LIMITS.installmentNotes.max} />}
      </label>
      <fieldset ref={guarantorSectionRef} className="scroll-mt-20 space-y-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 md:col-span-2">
        <div>
          <legend className="text-sm font-bold text-on-surface">Guarantors</legend>
          <p className="mt-1 text-[11px] text-on-surface-variant">Add exactly {requiredGuarantors} guarantors. For each guarantor, select an existing member or enter a new person’s verified details. Every field marked <span className="text-error">*</span> is required; only the KRA PIN may be left blank.</p>
        </div>
        {guarantorRows.map((row, index) => {
          const selectKey = `guarantor-${row.id}-select`
          const nameKey = `guarantor-${row.id}-name`
          const idKey = `guarantor-${row.id}-id`
          const phoneKey = `guarantor-${row.id}-phone`
          const kraKey = `guarantor-${row.id}-kra`
          const residenceKey = `guarantor-${row.id}-residence`
          const relationshipKey = `guarantor-${row.id}-relationship`
          const isLastRow = index === guarantorRows.length - 1
          return (
            <div key={row.id} ref={isLastRow ? lastGuarantorRowRef : undefined} className="rounded-xl border border-outline-variant bg-surface p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-bold text-on-surface">Guarantor {index + 1}</p><button type="button" onClick={() => setGuarantorRows((rows) => rows.filter((item) => item.id !== row.id))} aria-label={`Remove guarantor ${index + 1}`} title="Remove guarantor" className="grid h-8 w-8 place-items-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error"><span className="material-symbols-outlined text-[19px]">close</span></button></div>
              {row.mode === null && <p className="mb-2 text-[11px] font-semibold text-on-surface">Is this guarantor already a registered member?</p>}
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-1">
                <button type="button" onClick={() => setGuarantorRows((rows) => rows.map((item) => item.id === row.id ? { ...item, mode: 'registered' } : item))} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${row.mode === 'registered' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface'}`}>Yes — select existing member</button>
                <button type="button" onClick={() => setGuarantorRows((rows) => rows.map((item) => item.id === row.id ? { ...item, mode: 'external' } : item))} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${row.mode === 'external' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface'}`}>No — add new person</button>
              </div>
              {row.mode === 'registered' ? (
                <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={selectKey}>
                  Registered member<Required />
                  <select
                    id={selectKey}
                    name="guarantorIds"
                    required
                    defaultValue=""
                    aria-invalid={fieldErrors[selectKey] ? true : undefined}
                    aria-describedby={fieldErrors[selectKey] ? `${selectKey}-error` : undefined}
                    onChange={() => clearFieldError(selectKey)}
                    className={fieldClass(!!fieldErrors[selectKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface')}
                  >
                    <option value="" disabled>Select a member</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
                  </select>
                  <FieldError id={`${selectKey}-error`} message={fieldErrors[selectKey]} />
                </label>
              ) : row.mode === 'external' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={nameKey}>
                    Full legal name<Required />
                    <input
                      id={nameKey}
                      name="externalGuarantorName"
                      required
                      minLength={LOAN_GUARANTOR_LIMITS.fullName.min}
                      maxLength={LOAN_GUARANTOR_LIMITS.fullName.max}
                      title={`Enter first and last name (${LOAN_GUARANTOR_LIMITS.fullName.minWords}–${LOAN_GUARANTOR_LIMITS.fullName.maxWords} words, ${LOAN_GUARANTOR_LIMITS.fullName.max} characters max).`}
                      onBlur={(event) => event.currentTarget.reportValidity()}
                      onChange={() => clearFieldError(nameKey)}
                      autoComplete="name"
                      placeholder="e.g. Jane Wanjiru Kamau"
                      aria-invalid={fieldErrors[nameKey] ? true : undefined}
                      aria-describedby={fieldErrors[nameKey] ? `${nameKey}-error` : undefined}
                      className={fieldClass(!!fieldErrors[nameKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface')}
                    />
                    <FieldError id={`${nameKey}-error`} message={fieldErrors[nameKey]} />
                  </label>
                  <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={idKey}>
                    ID number<Required />
                    <input
                      id={idKey}
                      name="externalGuarantorIdNumber"
                      required
                      minLength={LOAN_GUARANTOR_LIMITS.idNumber.min}
                      maxLength={LOAN_GUARANTOR_LIMITS.idNumber.max}
                      pattern="[A-Za-z0-9-]{4,10}"
                      title={`Use ${LOAN_GUARANTOR_LIMITS.idNumber.min}–${LOAN_GUARANTOR_LIMITS.idNumber.max} letters, numbers or hyphens.`}
                      onBlur={(event) => event.currentTarget.reportValidity()}
                      onChange={() => clearFieldError(idKey)}
                      placeholder="National ID / passport"
                      aria-invalid={fieldErrors[idKey] ? true : undefined}
                      aria-describedby={fieldErrors[idKey] ? `${idKey}-error` : undefined}
                      className={fieldClass(!!fieldErrors[idKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface')}
                    />
                    <FieldError id={`${idKey}-error`} message={fieldErrors[idKey]} />
                  </label>
                  <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={phoneKey}>
                    Phone number<Required />
                    <input
                      id={phoneKey}
                      name="externalGuarantorPhone"
                      required
                      type="tel"
                      minLength={LOAN_GUARANTOR_LIMITS.phone.min}
                      maxLength={LOAN_GUARANTOR_LIMITS.phone.max}
                      pattern="(?:[+]254|254|0)[ -]?(?:7|1)(?:[ -]?[0-9]){8}"
                      title="Enter a valid Kenyan mobile number, for example 0712345678 or +254 712 345 678."
                      onBlur={(event) => event.currentTarget.reportValidity()}
                      onChange={() => clearFieldError(phoneKey)}
                      autoComplete="tel"
                      placeholder="0712345678"
                      aria-invalid={fieldErrors[phoneKey] ? true : undefined}
                      aria-describedby={fieldErrors[phoneKey] ? `${phoneKey}-error` : undefined}
                      className={fieldClass(!!fieldErrors[phoneKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface')}
                    />
                    <FieldError id={`${phoneKey}-error`} message={fieldErrors[phoneKey]} />
                  </label>
                  <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={kraKey}>
                    KRA PIN<Optional />
                    <input
                      id={kraKey}
                      name="externalGuarantorKraPin"
                      maxLength={LOAN_GUARANTOR_LIMITS.kraPin.max}
                      pattern="[AaPp][0-9]{9}[A-Za-z]"
                      title="Enter a valid KRA PIN such as A123456789B."
                      onBlur={(event) => event.currentTarget.reportValidity()}
                      onChange={() => clearFieldError(kraKey)}
                      placeholder="A123456789B"
                      aria-invalid={fieldErrors[kraKey] ? true : undefined}
                      aria-describedby={fieldErrors[kraKey] ? `${kraKey}-error` : undefined}
                      className={fieldClass(!!fieldErrors[kraKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal uppercase text-on-surface')}
                    />
                    <FieldError id={`${kraKey}-error`} message={fieldErrors[kraKey]} />
                  </label>
                  <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={residenceKey}>
                    Place of residence<Required />
                    <input
                      id={residenceKey}
                      name="externalGuarantorResidence"
                      required
                      minLength={LOAN_GUARANTOR_LIMITS.residence.min}
                      maxLength={LOAN_GUARANTOR_LIMITS.residence.max}
                      title={`Town, estate or village (${LOAN_GUARANTOR_LIMITS.residence.min}–${LOAN_GUARANTOR_LIMITS.residence.max} characters).`}
                      onBlur={(event) => event.currentTarget.reportValidity()}
                      onChange={() => clearFieldError(residenceKey)}
                      autoComplete="street-address"
                      placeholder="Town, estate or village"
                      aria-invalid={fieldErrors[residenceKey] ? true : undefined}
                      aria-describedby={fieldErrors[residenceKey] ? `${residenceKey}-error` : undefined}
                      className={fieldClass(!!fieldErrors[residenceKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface')}
                    />
                    <FieldError id={`${residenceKey}-error`} message={fieldErrors[residenceKey]} />
                  </label>
                  <label className="text-[11px] font-bold text-on-surface-variant" htmlFor={relationshipKey}>
                    Relationship to applicant<Required />
                    <input
                      id={relationshipKey}
                      name="externalGuarantorRelationship"
                      required
                      minLength={LOAN_GUARANTOR_LIMITS.relationship.min}
                      maxLength={LOAN_GUARANTOR_LIMITS.relationship.max}
                      title={`e.g. Mother, sibling, colleague (${LOAN_GUARANTOR_LIMITS.relationship.max} characters max).`}
                      onBlur={(event) => event.currentTarget.reportValidity()}
                      onChange={() => clearFieldError(relationshipKey)}
                      placeholder="e.g. Mother, sibling, colleague"
                      aria-invalid={fieldErrors[relationshipKey] ? true : undefined}
                      aria-describedby={fieldErrors[relationshipKey] ? `${relationshipKey}-error` : undefined}
                      className={fieldClass(!!fieldErrors[relationshipKey], 'mt-1 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface')}
                    />
                    <FieldError id={`${relationshipKey}-error`} message={fieldErrors[relationshipKey]} />
                  </label>
                </div>
              ) : null}
            </div>
          )
        })}
        <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant pt-3">
          {guarantorHint && (
            <p role="status" className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ' + (guarantorsNeeded > 0 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-green-50 text-green-800 ring-green-200')}>
              <span className="material-symbols-outlined text-[14px]">{guarantorsNeeded > 0 ? 'info' : 'check_circle'}</span>
              {guarantorHint}
            </p>
          )}
          <button
            type="button"
            disabled={guarantorRows.length >= requiredGuarantors}
            onClick={() => setGuarantorRows((rows) => rows.length >= requiredGuarantors ? rows : [...rows, { id: Date.now(), mode: null }])}
            className={'inline-flex w-fit items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-40' + (guarantorsAdded > 0 && guarantorsNeeded > 0 ? ' animate-pulse ring-2 ring-primary/40' : '')}
          >
            <span className="material-symbols-outlined text-[17px]">person_add</span>
            {addGuarantorLabel}
          </button>
        </div>
      </fieldset>
      {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 md:col-span-2">{formError}</p>}
      <p className="text-[11px] text-on-surface-variant md:col-span-2">Exactly {requiredGuarantors} complete guarantors are required · Applications go to the Treasurer for review.</p>
      <SubmitButton />
    </form>
  )
}
