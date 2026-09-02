'use client'

import { useState } from 'react'
import {
  OTHER_CATEGORY_DESCRIPTION_MAX,
  OTHER_CATEGORY_DESCRIPTION_MIN,
  OTHER_CATEGORY_ID,
} from '@/lib/payment-categories'

type Category = { id: string; name: string }

type Props = {
  categories: Category[]
  kind: 'income' | 'expense'
  /** When true, show the standard description/notes field for non-Other categories. */
  showDescription?: boolean
  descriptionName?: string
  descriptionPlaceholder?: string
  otherFieldName?: string
}

export default function PaymentCategoryFields({
  categories,
  kind,
  showDescription = true,
  descriptionName = 'description',
  descriptionPlaceholder = 'Short note about this payment',
  otherFieldName = 'otherCategoryDescription',
}: Props) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? OTHER_CATEGORY_ID)
  const isOther = categoryId === OTHER_CATEGORY_ID

  return (
    <>
      <label className="text-sm">
        Category
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="mt-1 block w-full rounded-lg border px-3 py-2"
        >
          {categories.length === 0 && (
            <option value="" disabled>
              No categories yet — ask an admin to add one
            </option>
          )}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={OTHER_CATEGORY_ID}>Other</option>
        </select>
      </label>

      {isOther ? (
        <label className="text-sm md:col-span-2">
          Explain this payment
          <textarea
            name={otherFieldName}
            required
            minLength={OTHER_CATEGORY_DESCRIPTION_MIN}
            maxLength={OTHER_CATEGORY_DESCRIPTION_MAX}
            rows={2}
            placeholder={
              kind === 'income'
                ? 'e.g. One-off donation for hall repairs'
                : 'e.g. Transport refund for committee visit'
            }
            className="mt-1 block w-full rounded-lg border px-3 py-2"
          />
          <span className="mt-1 block text-[11px] text-on-surface-variant">
            Required when category is Other ({OTHER_CATEGORY_DESCRIPTION_MIN}–{OTHER_CATEGORY_DESCRIPTION_MAX} characters).
          </span>
        </label>
      ) : showDescription ? (
        <input
          name={descriptionName}
          required
          minLength={2}
          maxLength={500}
          placeholder={descriptionPlaceholder}
          className="rounded-lg border px-3 py-2"
        />
      ) : null}
    </>
  )
}
