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
            . Social links:{' '}
            <Link href="/admin/content" className="text-primary underline">
              Public content
            </Link>
            .
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
        </section>

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
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <SettingForm
                settingKey={SETTING_KEYS.loanMaxAmountKes}
                label="Max amount (KES)"
                defaultValue={settings[SETTING_KEYS.loanMaxAmountKes] || '50000'}
              />
              <SettingForm
                settingKey={SETTING_KEYS.loanMinGuarantors}
                label="Min guarantors"
                defaultValue={settings[SETTING_KEYS.loanMinGuarantors] || '1'}
              />
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
}: {
  settingKey: string
  label: string
  defaultValue: string
  type?: string
}) {
  return (
    <form action={updateAppSetting} className="space-y-2">
      <input type="hidden" name="key" value={settingKey} />
      <label className="block text-sm">
        {label}
        <input
          name="value"
          type={type}
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
