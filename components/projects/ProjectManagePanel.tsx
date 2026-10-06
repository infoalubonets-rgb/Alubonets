import Link from 'next/link'
import ProjectManageTiles from '@/components/projects/ProjectManageTiles'
import { moneyNumber } from '@/lib/projects'

type Member = { id: string; fullName: string; email: string }
type Doc = { id: string; title: string }

type ProjectDetail = {
  id: string
  title: string
  status: string
  progress: number
  startDate: Date | null
  endDate: Date | null
  budgetKes: unknown
  fundingTargetKes: unknown
  actualExpenditureKes: unknown
  responsibles: { id: string; label: string | null; user: { id: string; fullName: string } }[]
  investments: {
    id: string
    amount: unknown
    investedAt: Date
    notes: string | null
    user: { fullName: string }
  }[]
  milestones: {
    id: string
    title: string
    dueAt: Date | null
    completedAt: Date | null
    position: number
  }[]
  updates: { id: string; title: string; body: string; publishedAt: Date }[]
  documents: { id: string; document: { id: string; title: string } }[]
}

type Financials = {
  raisedFromInvestments: number
  raisedFromContributions: number
  raised: number
  spent: number
  linkedExpenseCount: number
}

const iso = (value: Date | null) => (value ? value.toISOString() : null)

export default function ProjectManagePanel({
  project,
  financials,
  members,
  documents,
  manageBase,
}: {
  project: ProjectDetail
  financials: Financials
  members: Member[]
  documents: Doc[]
  manageBase: string
}) {
  const raised = financials.raised
  const target = moneyNumber(project.fundingTargetKes)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : project.progress

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={manageBase} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Projects
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate font-h3 text-2xl text-primary">{project.title}</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              {project.status.replaceAll('_', ' ')}
            </span>
          </div>
        </div>
        <a
          href={`/api/export/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-3.5 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Export
        </a>
      </div>

      <section className="rounded-2xl border bg-surface p-4 shadow-sm md:p-5">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Funding</p><p className="mt-1 text-2xl font-black text-primary">KES {raised.toLocaleString()}</p></div>
          <p className="text-sm font-bold text-primary">{percent}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
          <ProjectStat label="Target" value={target > 0 ? `KES ${target.toLocaleString()}` : 'Not set'} />
          <ProjectStat label="Investments" value={`KES ${financials.raisedFromInvestments.toLocaleString()}`} />
          <ProjectStat label="Member payments" value={`KES ${financials.raisedFromContributions.toLocaleString()}`} />
          <ProjectStat label="Spent" value={`KES ${financials.spent.toLocaleString()}`} />
        </div>
      </section>

      <ProjectManageTiles
        members={members.map((m) => ({ id: m.id, label: m.fullName }))}
        documents={documents.map((d) => ({ id: d.id, label: d.title }))}
        project={{
          id: project.id,
          startDate: iso(project.startDate),
          endDate: iso(project.endDate),
          budgetKes: moneyNumber(project.budgetKes),
          fundingTargetKes: target,
          actualExpenditureKes: moneyNumber(project.actualExpenditureKes),
          responsibles: project.responsibles.map((r) => ({ id: r.id, label: r.label, fullName: r.user.fullName })),
          investments: project.investments.map((i) => ({
            id: i.id,
            amount: moneyNumber(i.amount),
            investedAt: i.investedAt.toISOString(),
            notes: i.notes,
            memberName: i.user.fullName,
          })),
          milestones: project.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            dueAt: iso(m.dueAt),
            completedAt: iso(m.completedAt),
          })),
          updates: project.updates.map((u) => ({ id: u.id, title: u.title, body: u.body, publishedAt: u.publishedAt.toISOString() })),
          documents: project.documents.map((d) => ({ id: d.id, documentId: d.document.id, title: d.document.title })),
        }}
      />
    </div>
  )
}

function ProjectStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface-container-low p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className="mt-1 truncate font-semibold text-on-surface">{value}</p></div>
}
