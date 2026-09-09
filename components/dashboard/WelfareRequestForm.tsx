'use client'

import { useFormStatus } from 'react-dom'

type Props = {
  action: (formData: FormData) => Promise<void>
  minAmount: number
  maxAmount: number
  categories: { id: string; name: string }[]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <>
          Submitting
          <span className="flex items-center gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-primary [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-primary [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-primary" />
          </span>
        </>
      ) : (
        'Submit request'
      )}
    </button>
  )
}

export default function WelfareRequestForm({
  action,
  minAmount,
  maxAmount,
  categories,
}: Props) {
  return (
    <form action={action} className="grid gap-3">
      <label className="text-xs font-bold text-on-surface-variant">
        Describe your need
        <textarea
          name="description"
          required
          minLength={3}
          rows={4}
          placeholder="Tell us what support you need and why…"
          className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <label className="text-xs font-bold text-on-surface-variant">
        Beneficiary name
        <input
          name="beneficiaryName"
          maxLength={120}
          placeholder="Who should receive this support?"
          className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <label className="text-xs font-bold text-on-surface-variant">
        Support type
        <input
          name="supportType"
          maxLength={80}
          placeholder="Medical, bereavement, emergency…"
          className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      {categories.length > 0 && (
        <label className="text-xs font-bold text-on-surface-variant">
          Category
          <select
            name="categoryId"
            className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="text-xs font-bold text-on-surface-variant">
        Confidentiality
        <select
          name="confidentiality"
          defaultValue="STANDARD"
          className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
        >
          <option value="STANDARD">Standard — officers see requester details</option>
          <option value="CONFIDENTIAL">Confidential — restricted to welfare officers</option>
        </select>
      </label>
      <label className="text-xs font-bold text-on-surface-variant">
        Requested amount
        <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">KES</span>
          <input
            name="amount"
            type="number"
            min={minAmount}
            max={maxAmount}
            step="0.01"
            required
            placeholder="0"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2.5 pl-12 pr-3 text-sm font-normal text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </label>
      <p className="-mt-1 text-[11px] text-on-surface-variant">Allowed amount: KES {minAmount.toLocaleString()}–{maxAmount.toLocaleString()}</p>
      <SubmitButton />
    </form>
  )
}
