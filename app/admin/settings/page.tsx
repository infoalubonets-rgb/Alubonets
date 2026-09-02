import Link from 'next/link'
import type { ReactNode } from 'react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireAdmin } from '@/lib/auth/session'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { prisma } from '@/lib/prisma'
import { FEATURE_FLAGS, getFeatureFlags } from '@/lib/feature-flags'
import { SETTING_KEYS, getSettings } from '@/lib/settings'
import {
  toggleFeatureFlag,
  updateAppSetting,
  upsertContributionCategorySetting,
  upsertMembershipClass,
  upsertProjectCategory,
  upsertWelfareCategory,
  updateWelfareAmountLimits,
  updateLoanAmountLimits,
  updateLoanPolicy,
} from '@/app/actions/settings'

export default async function AdminSettingsPage() {
  await requireAdmin()
  const [flags, settings, txCats, welfareCats, projectCats, membershipClasses, nav] = await Promise.all([
    getFeatureFlags(),
    getSettings(Object.values(SETTING_KEYS)),
    prisma.transactionCategory.findMany({ orderBy: { name: 'asc' }, take: 80 }),
    prisma.welfareCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.projectCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.membershipClass.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    navWithLoans('ADMIN'),
  ])
  const loansOn = Boolean(flags[FEATURE_FLAGS.loansEnabled])
  const welfareOn = Boolean(flags[FEATURE_FLAGS.welfareEnabled])

  return (
    <DashboardShell role="ADMIN" title="Settings" nav={nav}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Feature flags</h2>
          <form action={toggleFeatureFlag} className="mt-3 flex items-center gap-3">
            <input type="hidden" name="key" value={FEATURE_FLAGS.loansEnabled} />
            <label className="text-sm">
              <input type="checkbox" name="enabled" defaultChecked={loansOn} /> Enable loans module
            </label>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save</button>
          </form>
          <p className="mt-2 text-xs text-on-surface-variant">
            When off, loan routes and actions are hidden/blocked. Templates:{' '}
            <Link href="/admin/announcements" className="text-primary underline">
              Announcements
            </Link>
            .
          </p>
          <form action={toggleFeatureFlag} className="mt-4 flex items-center gap-3 border-t pt-4">
            <input type="hidden" name="key" value={FEATURE_FLAGS.welfareEnabled} />
            <label className="text-sm">
              <input type="checkbox" name="enabled" defaultChecked={welfareOn} /> Enable welfare module
            </label>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save</button>
          </form>
          <p className="mt-2 text-xs text-on-surface-variant">
            When off, the Welfare nav item and routes are hidden for members and treasurers.
          </p>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Branding</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SettingForm
              settingKey={SETTING_KEYS.brandingSiteName}
              label="Site name"
              defaultValue={settings[SETTING_KEYS.brandingSiteName]}
            />
            <SettingForm
              settingKey={SETTING_KEYS.brandingPrimaryHex}
              label="Primary color (#hex)"
              defaultValue={settings[SETTING_KEYS.brandingPrimaryHex]}
            />
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Preview name: <b>{settings[SETTING_KEYS.brandingSiteName] || 'Alubonets'}</b>
          </p>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Contact & finance</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SettingForm
              settingKey={SETTING_KEYS.contactDestinationEmail}
              label="Contact destination email"
              defaultValue={settings[SETTING_KEYS.contactDestinationEmail]}
              type="email"
            />
            <SettingForm
              settingKey={SETTING_KEYS.financialApprovalThresholdKes}
              label="Financial approval threshold (KES)"
              defaultValue={settings[SETTING_KEYS.financialApprovalThresholdKes] || '50000'}
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Password policy</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SettingForm
              settingKey={SETTING_KEYS.passwordMinLength}
              label="Minimum length"
              defaultValue={settings[SETTING_KEYS.passwordMinLength] || '8'}
            />
            <form action={updateAppSetting} className="space-y-2">
              <input type="hidden" name="key" value={SETTING_KEYS.passwordRequireMixed} />
              <label className="text-sm">Require mixed case / number</label>
              <select
                name="value"
                defaultValue={settings[SETTING_KEYS.passwordRequireMixed] || 'false'}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
              <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save</button>
            </form>
          </div>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Audit retention</h2>
          <SettingForm
            settingKey={SETTING_KEYS.auditRetentionDays}
            label="Retention days"
            defaultValue={settings[SETTING_KEYS.auditRetentionDays] || '365'}
          />
          <p className="mt-3 text-sm">
            <Link href="/admin/audit-logs" className="text-primary underline">
              View activity logs
            </Link>
          </p>
        </section>

        {welfareOn && (
          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Welfare amount limits</h2>
            <p className="mt-1 text-xs text-on-surface-variant">Members can only submit Welfare requests within this KES range.</p>
            <form action={updateWelfareAmountLimits} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Minimum request (KES)<input name="min" type="number" min="0" step="0.01" required defaultValue={settings[SETTING_KEYS.welfareMinAmountKes] || '1000'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <label className="text-sm">Maximum request (KES)<input name="max" type="number" min="1" step="0.01" required defaultValue={settings[SETTING_KEYS.welfareMaxAmountKes] || '100000'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary md:col-span-2">Save welfare limits</button>
            </form>
          </section>
        )}

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Family account transition</h2>
          <SettingForm
            settingKey={SETTING_KEYS.familyAdulthoodAge}
            label="Age at which a record-only child may be invited"
            defaultValue={settings[SETTING_KEYS.familyAdulthoodAge] || '18'}
            type="number"
          />
        </section>

        {loansOn && (
          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Loan policy</h2>
            <form action={updateLoanAmountLimits} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Min amount (KES)<input name="min" type="number" min="0" max="999999" step="1" required defaultValue={settings[SETTING_KEYS.loanMinAmountKes] || '1300'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <label className="text-sm">Max amount (KES)<input name="max" type="number" min="100" max="999999" step="1" required defaultValue={settings[SETTING_KEYS.loanMaxAmountKes] || '50000'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary md:col-span-2">Save loan amount limits</button>
            </form>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm">Required guarantors</p>
                <p className="rounded-lg border bg-surface-container-low px-3 py-2 text-sm font-semibold">2 (fixed)</p>
              </div>
              <form action={updateAppSetting} className="space-y-2">
                <input type="hidden" name="key" value={SETTING_KEYS.loanRequireGuarantorAccept} />
                <label className="text-sm">Guarantors must accept before approve</label>
                <select
                  name="value"
                  defaultValue={settings[SETTING_KEYS.loanRequireGuarantorAccept] || 'true'}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save</button>
              </form>
            </div>
            <p className="mt-2 text-sm">
              Approve queue:{' '}
              <Link href="/admin/loans" className="text-primary underline">
                /admin/loans
              </Link>
            </p>

            <div className="mt-5 border-t pt-4">
              <h3 className="font-h3 text-base text-primary">Loan policy document</h3>
              <p className="mt-1 text-xs text-on-surface-variant">Shown to applicants as a downloadable PDF, styled with the site letterhead.</p>
              <form action={updateLoanPolicy} className="mt-3 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">Title<input name="title" type="text" required maxLength={200} defaultValue={settings[SETTING_KEYS.loanPolicyTitle] || 'Loan Policy'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
                  <label className="text-sm">Effective date<input name="effectiveDate" type="date" defaultValue={settings[SETTING_KEYS.loanPolicyEffectiveDate] || ''} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
                </div>
                <label className="text-sm">Content<textarea name="content" rows={10} maxLength={20000} placeholder="Write the loan policy here…" defaultValue={settings[SETTING_KEYS.loanPolicyContent] || ''} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save loan policy</button>
                  <a href="/api/pdf/loan-policy?download=1" target="_blank" rel="noopener noreferrer" className="w-fit rounded-full border border-primary px-4 py-2 text-sm text-primary">
                    Download PDF
                  </a>
                </div>
              </form>
            </div>
          </section>
        )}

        <CategorySection
          title="Contribution / transaction categories"
          items={txCats.map((c) => ({ id: c.id, label: `${c.code} — ${c.name} (${c.type})` }))}
        >
          <form action={upsertContributionCategorySetting} className="mt-3 grid gap-2 md:grid-cols-4">
            <input name="code" required placeholder="CODE" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" />
            <select name="type" className="rounded-lg border px-3 py-2 text-sm">
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
              <option value="BOTH">BOTH</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add category</button>
          </form>
        </CategorySection>

        <CategorySection title="Welfare categories" items={welfareCats.map((c) => ({ id: c.id, label: c.name }))}>
          <form action={upsertWelfareCategory} className="mt-3 flex flex-wrap gap-2">
            <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="sortOrder" type="number" defaultValue={0} className="w-24 rounded-lg border px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add</button>
          </form>
        </CategorySection>

        <CategorySection title="Project categories" items={projectCats.map((c) => ({ id: c.id, label: c.name }))}>
          <form action={upsertProjectCategory} className="mt-3 flex flex-wrap gap-2">
            <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="sortOrder" type="number" defaultValue={0} className="w-24 rounded-lg border px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add</button>
          </form>
        </CategorySection>

        <CategorySection title="Membership classes" items={membershipClasses.map((c) => ({ id: c.id, label: c.name }))}>
          <form action={upsertMembershipClass} className="mt-3 flex flex-wrap gap-2">
            <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="sortOrder" type="number" defaultValue={0} className="w-24 rounded-lg border px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add</button>
          </form>
        </CategorySection>

      </div>
    </DashboardShell>
  )
}

function SettingForm({
  settingKey,
  label,
  defaultValue,
  type = 'text',
  min,
  max,
  step,
}: {
  settingKey: string
  label: string
  defaultValue: string
  type?: string
  min?: string
  max?: string
  step?: string
}) {
  return (
    <form action={updateAppSetting} className="space-y-2">
      <input type="hidden" name="key" value={settingKey} />
      <label className="block text-sm">
        {label}
        <input
          name="value"
          type={type}
          min={min}
          max={max}
          step={step}
          required
          defaultValue={defaultValue}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </label>
      <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save</button>
    </form>
  )
}

function CategorySection({
  title,
  items,
  children,
}: {
  title: string
  items: { id: string; label: string }[]
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-lg text-primary">{title}</h2>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
        {items.map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
        {!items.length && <li className="text-on-surface-variant">None yet.</li>}
      </ul>
      {children}
    </section>
  )
}
