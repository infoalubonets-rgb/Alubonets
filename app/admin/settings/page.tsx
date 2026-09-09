import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import SettingsSectionButton from '@/components/admin/SettingsSectionButton'
import FeatureFlagsToggles from '@/components/admin/FeatureFlagsToggles'
import ContactFinanceForm from '@/components/admin/ContactFinanceForm'
import FinanceDestinationForm from '@/components/admin/FinanceDestinationForm'
import AppSettingForm from '@/components/admin/AppSettingForm'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import { requireAdmin } from '@/lib/auth/session'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { prisma } from '@/lib/prisma'
import { FEATURE_FLAGS, getFeatureFlags } from '@/lib/feature-flags'
import { SETTING_KEYS, getSettings } from '@/lib/settings'
import { CONTACT_EMAIL } from '@/lib/constants'
import DirectoryFullAccessForm from '@/components/admin/DirectoryFullAccessForm'
import {
  updateAppSetting,
  updateWelfareAmountLimits,
  updateLoanAmountLimits,
  updateLoanPolicy,
} from '@/app/actions/settings'
import { DIRECTORY_FULL_ACCESS_SETTING } from '@/app/actions/directory'

export default async function AdminSettingsPage() {
  await requireAdmin()
  const [flags, settings, txCats, nav, financeDestination, fundRule, directoryAccess] = await Promise.all([
    getFeatureFlags(),
    getSettings(Object.values(SETTING_KEYS)),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], take: 80 }),
    navWithLoans('ADMIN'),
    prisma.financeSettingVersion.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
    prisma.fundAllocationRule.findFirst({ where: { active: true }, orderBy: { version: 'desc' } }),
    prisma.appSetting.findUnique({ where: { key: DIRECTORY_FULL_ACCESS_SETTING } }),
  ])
  const directoryFullAccessRoles = (directoryAccess?.value || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const loansOn = Boolean(flags[FEATURE_FLAGS.loansEnabled])
  const welfareOn = Boolean(flags[FEATURE_FLAGS.welfareEnabled])

  return (
    <DashboardShell role="ADMIN" title="Settings" nav={nav}>
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
        <SettingsSectionButton
          title="Feature flags"
          description="Enable or disable the loans and welfare modules"
          icon="toggle_on"
        >
          <FeatureFlagsToggles loansEnabled={loansOn} welfareEnabled={welfareOn} />
        </SettingsSectionButton>

        <SettingsSectionButton
          title="Contact & finance"
          description="Footer contact details, enquiry forwarding, and approval threshold"
          icon="mail"
        >
          <ContactFinanceForm
            publicEmail={settings[SETTING_KEYS.contactPublicEmail] || CONTACT_EMAIL}
            publicPhone={settings[SETTING_KEYS.contactPublicPhone] || ''}
            enquiryEmail={settings[SETTING_KEYS.contactDestinationEmail] || CONTACT_EMAIL}
            approvalThreshold={settings[SETTING_KEYS.financialApprovalThresholdKes] || '50000'}
          />
        </SettingsSectionButton>

        <SettingsSectionButton
          title="Official payment destination"
          description="Group bank / paybill details with change history and fund allocation"
          icon="account_balance"
        >
          <FinanceDestinationForm
            destination={financeDestination}
            allocation={fundRule}
          />
        </SettingsSectionButton>

        <SettingsSectionButton title="Audit retention" description="How long activity logs are kept" icon="history">
          <AppSettingForm
            settingKey={SETTING_KEYS.auditRetentionDays}
            label="Retention days"
            defaultValue={settings[SETTING_KEYS.auditRetentionDays] || '365'}
          />
          <p className="mt-3 text-sm">
            <Link href="/admin/audit-logs" className="text-primary underline">
              View activity logs
            </Link>
          </p>
        </SettingsSectionButton>

        {welfareOn && (
          <SettingsSectionButton
            title="Welfare amount limits"
            description="Min/max KES members can request"
            icon="volunteer_activism"
          >
            <p className="text-xs text-on-surface-variant">Members can only submit Welfare requests within this KES range.</p>
            <form action={updateWelfareAmountLimits} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Minimum request (KES)<input name="min" type="number" min="0" step="0.01" required defaultValue={settings[SETTING_KEYS.welfareMinAmountKes] || '1000'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <label className="text-sm">Maximum request (KES)<input name="max" type="number" min="1" step="0.01" required defaultValue={settings[SETTING_KEYS.welfareMaxAmountKes] || '100000'} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary md:col-span-2">Save welfare limits</button>
            </form>
          </SettingsSectionButton>
        )}

        {loansOn && (
          <SettingsSectionButton
            title="Loan management"
            description="Amount limits, guarantor rules, and the loan policy document"
            icon="account_balance"
          >
            <form action={updateLoanAmountLimits} className="grid gap-3 md:grid-cols-2">
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
          </SettingsSectionButton>
        )}

        <SettingsSectionButton
          title="Directory privacy"
          description="Who may see the full member list (children stay hidden by default)"
          icon="visibility"
        >
          <DirectoryFullAccessForm selectedRoles={directoryFullAccessRoles} />
        </SettingsSectionButton>

        <SettingsSectionButton
          title="Contribution / transaction categories"
          description="Categories used to label income and expenses"
          icon="category"
        >
          <ContributionCategoriesManager
            categories={txCats.map((category) => ({
              id: category.id,
              name: category.name,
              type: category.type,
              system: ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'WELFARE_DISBURSEMENT', 'OTHER'].includes(category.code),
            }))}
          />
        </SettingsSectionButton>
      </div>
    </DashboardShell>
  )
}
