'use client'

import { useState } from 'react'
import {
  OTHER_CATEGORY_DESCRIPTION_MAX,
  OTHER_CATEGORY_DESCRIPTION_MIN,
  OTHER_CATEGORY_ID,
  PROJECT_CATEGORY_ID,
} from '@/lib/payment-categories'

type Category = { id: string; name: string; billingKind?: string | null }
type Campaign = { id: string; title: string; categoryId: string }
type Project = { id: string; title: string }

type Props = {
  categories: Category[]
  kind: 'income' | 'expense'
  /** Active campaigns appear as purposes; choosing one fills `campaignId`. */
  campaigns?: Campaign[]
  /** Projects appear as purposes; choosing one fills `projectId`. */
  projects?: Project[]
  /** When true, show the standard description/notes field for non-Other categories. */
  showDescription?: boolean
  descriptionName?: string
  descriptionPlaceholder?: string
  otherFieldName?: string
  /** Called with the billing kind of the chosen purpose (MONTHLY / ANNUAL / NONE). */
  onBillingKindChange?: (kind: string) => void
}

function parsePurpose(value: string, campaigns: Campaign[]) {
  if (value.startsWith('campaign:')) {
    const campaign = campaigns.find((c) => `campaign:${c.id}` === value)
    return { categoryId: campaign?.categoryId ?? '', campaignId: campaign?.id ?? '', projectId: '' }
  }
  if (value.startsWith('project:')) {
    return { categoryId: PROJECT_CATEGORY_ID, campaignId: '', projectId: value.slice('project:'.length) }
  }
  return { categoryId: value, campaignId: '', projectId: '' }
}

export default function PaymentCategoryFields({
  categories,
  kind,
  campaigns = [],
  projects = [],
  showDescription = true,
  descriptionName = 'description',
  descriptionPlaceholder = 'Short note about this payment',
  otherFieldName = 'otherCategoryDescription',
  onBillingKindChange,
}: Props) {
  const [purpose, setPurpose] = useState('')
  const isOther = purpose === OTHER_CATEGORY_ID
  const parsed = parsePurpose(purpose, campaigns)

  function choose(value: string) {
    setPurpose(value)
    const category = categories.find((c) => c.id === value)
    onBillingKindChange?.(category?.billingKind || 'NONE')
  }

  return (
    <>
      <label className="text-sm">
        Purpose <span className="text-error">*</span>
        <select
          required
          value={purpose}
          onChange={(event) => choose(event.target.value)}
          className="mt-1 block w-full rounded-lg border px-3 py-2"
        >
          <option value="" disabled>
            Choose the purpose of this payment…
          </option>
          {categories.length > 0 && (
            <optgroup label={kind === 'income' ? 'Payment purposes' : 'Expense categories'}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.billingKind === 'MONTHLY' ? ' (monthly)' : category.billingKind === 'ANNUAL' ? ' (annual)' : ''}
                </option>
              ))}
            </optgroup>
          )}
          {campaigns.length > 0 && (
            <optgroup label="Campaigns">
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={`campaign:${campaign.id}`}>{campaign.title}</option>
              ))}
            </optgroup>
          )}
          {projects.length > 0 && (
            <optgroup label="Projects">
              {projects.map((project) => (
                <option key={project.id} value={`project:${project.id}`}>{project.title}</option>
              ))}
            </optgroup>
          )}
          <option value={OTHER_CATEGORY_ID}>Other</option>
        </select>
      </label>
      <input type="hidden" name="categoryId" value={parsed.categoryId} />
      <input type="hidden" name="campaignId" value={parsed.campaignId} />
      <input type="hidden" name="projectId" value={parsed.projectId} />

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
            Required when purpose is Other ({OTHER_CATEGORY_DESCRIPTION_MIN}–{OTHER_CATEGORY_DESCRIPTION_MAX} characters).
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
