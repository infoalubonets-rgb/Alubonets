import IconModalButton from '@/components/ui/IconModalButton'
import { PurposeSettingsEditor } from '@/components/finance/PurposeSettingsEditor'
import RecordExpenseForm from '@/components/finance/RecordExpenseForm'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import { appTodayInputValue } from '@/lib/dates'
import { filterSelectableCategories, isSystemCategoryCode } from '@/lib/payment-categories'
import { prisma } from '@/lib/prisma'

/** Financial ledger header buttons: record expense and payment purposes. */
export default async function LedgerActions({ canRecord, canManagePurposes }: { canRecord: boolean; canManagePurposes: boolean }) {
  if (!canRecord && !canManagePurposes) return null

  const [categories, projects, accounts] = await Promise.all([
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    canRecord
      ? prisma.project.findMany({ where: { status: { not: 'COMPLETED' } }, orderBy: { title: 'asc' }, select: { id: true, title: true } })
      : Promise.resolve([]),
    canRecord ? prisma.financialAccount.findMany({ where: { active: true, type: 'ASSET' }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ])
  const today = appTodayInputValue()

  return (
    <>
      {canRecord && (
        <>
          <IconModalButton icon="receipt_long" label="Record expense" title="Record expense" showText>
            <RecordExpenseForm categories={filterSelectableCategories(categories, 'expense')} accounts={accounts} projects={projects} today={today} />
          </IconModalButton>
        </>
      )}
      {canManagePurposes && (
        <IconModalButton icon="category" label="Payment purposes" title="Payment purposes" showText size="wide">
          <p className="mb-3 text-xs text-on-surface-variant">
            Add purposes the Treasurer can pick. Mark the monthly fee and annual subscription purposes so membership standing is calculated correctly.
          </p>
          <div className="mb-6"><PurposeSettingsEditor /></div>
          <ContributionCategoriesManager
            categories={categories
              .filter((category) => !isSystemCategoryCode(category.code))
              .map((category) => ({ id: category.id, name: category.name, type: category.type, billingKind: category.billingKind, system: false }))}
          />
        </IconModalButton>
      )}
    </>
  )
}
