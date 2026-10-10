import IconModalButton from '@/components/ui/IconModalButton'
import RecordContributionForm from '@/components/finance/RecordContributionForm'
import { prisma } from '@/lib/prisma'
import { getAccountProfile } from '@/lib/auth/session'
import { canRecordContributions, canRecordContributionFor } from '@/lib/finance-access'
import { appTodayInputValue } from '@/lib/dates'
import { filterSelectableCategories } from '@/lib/payment-categories'

export default async function AddContributionButton() {
  const actor = await getAccountProfile()
  if (!actor || !canRecordContributions(actor)) {
    return <button type="button" disabled className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-full bg-gray-200 px-4 text-xs font-semibold text-gray-500"><span className="material-symbols-outlined text-[18px]">add</span>Add contribution</button>
  }
  const [members, categories, campaigns, accounts, projects] = await Promise.all([
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true, membershipNumber: true } }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.contributionCampaign.findMany({ where: { active: true }, orderBy: { startsAt: 'desc' }, select: { id: true, title: true, categoryId: true } }),
    prisma.financialAccount.findMany({ where: { active: true, type: 'ASSET' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { status: { not: 'COMPLETED' } }, orderBy: { title: 'asc' }, select: { id: true, title: true } }),
  ])

  return (
    <IconModalButton icon="add" label="Add contribution" title="Add contribution" variant="orange" size="wide" showText>
      <RecordContributionForm
        currentUserId={actor.role === 'TREASURER' && !actor.isSuperAdmin ? actor.id : undefined}
        members={members.filter((member) => canRecordContributionFor(actor, member.id))}
        categories={filterSelectableCategories(categories, 'income')}
        campaigns={campaigns}
        accounts={accounts}
        projects={projects}
        today={appTodayInputValue()}
      />
    </IconModalButton>
  )
}
