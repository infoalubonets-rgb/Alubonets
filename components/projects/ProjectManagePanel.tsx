import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  addProjectMilestone,
  addProjectResponsible,
  completeProjectMilestone,
  deleteProjectInvestment,
  linkProjectDocument,
  moderateProjectComment,
  publishProjectUpdate,
  recordProjectInvestment,
  removeProjectResponsible,
  unlinkProjectDocument,
  updateProjectFinance,
  updateProjectSchedule,
} from '@/app/actions/projects'
import { moneyNumber } from '@/lib/projects'
import { todayInputValue } from '@/lib/dates'

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
  comments: {
    id: string
    body: string
    status: string
    createdAt: Date
    author: { fullName: string }
  }[]
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

export default function ProjectManagePanel({
  project,
  financials,
  members,
  documents,
  manageBase,
  canModerate = false,
}: {
  project: ProjectDetail
  financials: Financials
  members: Member[]
  documents: Doc[]
  manageBase: string
  canModerate?: boolean
}) {
  const raised = financials.raised
  const target = moneyNumber(project.fundingTargetKes)
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : project.progress
  const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : '')

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

      <div className="grid gap-3 lg:grid-cols-2">
      <ManageSection title="Schedule" icon="calendar_month" meta={project.startDate && project.endDate ? `${project.startDate.toLocaleDateString()} – ${project.endDate.toLocaleDateString()}` : 'Set project dates'}>
        <form action={updateProjectSchedule} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="text-xs">
            Start date
            <input name="startDate" type="date" defaultValue={day(project.startDate)} className="mt-1 block rounded-lg border px-3 py-2" />
          </label>
          <label className="text-xs">
            End date
            <input name="endDate" type="date" defaultValue={day(project.endDate)} className="mt-1 block rounded-lg border px-3 py-2" />
          </label>
          <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save dates</button>
        </form>
      </ManageSection>

      <ManageSection title="Financial settings" icon="account_balance_wallet" meta="Budget, target and expenditure">
        <form action={updateProjectFinance} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="text-xs">
            Budget (KES)
            <input
              name="budgetKes"
              type="number"
              min={0}
              step="0.01"
              defaultValue={moneyNumber(project.budgetKes)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-xs">
            Funding target
            <input
              name="fundingTargetKes"
              type="number"
              min={0}
              step="0.01"
              defaultValue={moneyNumber(project.fundingTargetKes)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-xs">
            Actual expenditure
            <input
              name="actualExpenditureKes"
              type="number"
              min={0}
              step="0.01"
              defaultValue={moneyNumber(project.actualExpenditureKes)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-xs">
            Reason
            <input name="reason" required minLength={3} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary sm:col-span-2">Save finance</button>
        </form>
      </ManageSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ManageSection title="Investments" icon="trending_up" meta={`${project.investments.length} recorded`}>
          <form action={recordProjectInvestment} className="space-y-2">
            <input type="hidden" name="projectId" value={project.id} />
            <select name="userId" required className="w-full rounded-lg border px-3 py-2">
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <input name="amount" type="number" min={1} step="0.01" required placeholder="Amount KES" className="w-full rounded-lg border px-3 py-2" />
            <input name="investedAt" type="date" max={todayInputValue()} title="An investment cannot be recorded with a future date." className="w-full rounded-lg border px-3 py-2" />
            <input name="notes" placeholder="Notes" className="w-full rounded-lg border px-3 py-2" />
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add investment</button>
          </form>
          <ul className="mt-4 divide-y text-sm">
            {project.investments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {row.user.fullName} · KES {moneyNumber(row.amount).toLocaleString()} ·{' '}
                  {row.investedAt.toLocaleDateString()}
                </span>
                <form action={deleteProjectInvestment} className="flex gap-1">
                  <input type="hidden" name="id" value={row.id} />
                  <input name="reason" required placeholder="Reason" className="rounded border px-2 py-1 text-xs" />
                  <button className="text-xs text-error underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </ManageSection>

        <ManageSection title="Project team" icon="group" meta={`${project.responsibles.length} assigned`}>
          <form action={addProjectResponsible} className="flex flex-wrap gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <select name="userId" required className="rounded-lg border px-3 py-2">
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <input name="label" placeholder="Label e.g. Lead" className="rounded-lg border px-3 py-2" />
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add</button>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {project.responsibles.map((row) => (
              <li key={row.id} className="flex justify-between gap-2">
                <span>
                  {row.user.fullName}
                  {row.label ? ` · ${row.label}` : ''}
                </span>
                <form action={removeProjectResponsible}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className="text-error underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </ManageSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ManageSection title="Milestones" icon="flag" meta={`${project.milestones.filter((item) => item.completedAt).length}/${project.milestones.length} completed`}>
          <form action={addProjectMilestone} className="space-y-2">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="title" required placeholder="Milestone title" className="w-full rounded-lg border px-3 py-2" />
            <input name="description" placeholder="Description" className="w-full rounded-lg border px-3 py-2" />
            <input name="dueAt" type="date" min={todayInputValue()} title="A milestone cannot be due in the past." className="rounded-lg border px-3 py-2" />
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Add milestone</button>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                <span>
                  {m.title}
                  {m.dueAt ? ` · due ${m.dueAt.toLocaleDateString()}` : ''}
                  {m.completedAt ? ' · done' : ''}
                </span>
                <form action={completeProjectMilestone}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="complete" value={m.completedAt ? 'false' : 'true'} />
                  <button className="text-primary underline">
                    {m.completedAt ? 'Reopen' : 'Complete'}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </ManageSection>

        <ManageSection title="Project updates" icon="campaign" meta={`${project.updates.length} published`}>
          <form action={publishProjectUpdate} className="space-y-2">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="title" required placeholder="Update title" className="w-full rounded-lg border px-3 py-2" />
            <textarea name="body" required placeholder="Update body" className="w-full rounded-lg border px-3 py-2" rows={4} />
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Publish</button>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {project.updates.map((u) => (
              <li key={u.id} className="rounded-lg border p-2">
                <b>{u.title}</b>
                <p className="text-xs text-on-surface-variant">{u.publishedAt.toLocaleString()}</p>
                <p className="mt-1 whitespace-pre-line">{u.body}</p>
              </li>
            ))}
          </ul>
        </ManageSection>
      </div>

      <ManageSection title="Documents" icon="folder" meta={`${project.documents.length} linked`}>
        <form action={linkProjectDocument} className="flex flex-wrap gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <select name="documentId" required className="rounded-lg border px-3 py-2">
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Link document</button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {project.documents.map((row) => (
            <li key={row.id} className="flex justify-between gap-2">
              <a href={`/api/documents/${row.document.id}/download`} className="text-primary underline">
                {row.document.title}
              </a>
              <form action={unlinkProjectDocument}>
                <input type="hidden" name="id" value={row.id} />
                <button className="text-error underline">Unlink</button>
              </form>
            </li>
          ))}
        </ul>
      </ManageSection>

      {canModerate && (
      <ManageSection title="Comment moderation" icon="forum" meta={`${project.comments.length} comments`}>
        <div className="space-y-3">
          {project.comments.map((c) => (
            <article key={c.id} className="rounded-xl border p-3">
              <p className="text-sm">
                <b>{c.author.fullName}</b> · {c.status} · {c.createdAt.toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{c.body}</p>
              <form action={moderateProjectComment} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={c.id} />
                <select name="status" defaultValue={c.status} className="rounded-lg border px-2 py-1 text-sm">
                  <option>PENDING</option>
                  <option>PUBLISHED</option>
                  <option>HIDDEN</option>
                  <option>REJECTED</option>
                </select>
                <input name="moderationNote" placeholder="Note" className="rounded-lg border px-2 py-1 text-sm" />
                <input name="reason" required placeholder="Reason" className="rounded-lg border px-2 py-1 text-sm" />
                <button className="text-sm text-primary underline">Update</button>
              </form>
            </article>
          ))}
          {!project.comments.length && <p className="text-sm text-on-surface-variant">No comments.</p>}
        </div>
      </ManageSection>
      )}
    </div>
  )
}

function ProjectStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface-container-low p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className="mt-1 truncate font-semibold text-on-surface">{value}</p></div>
}

function ManageSection({ title, icon, meta, children }: { title: string; icon: string; meta: string; children: ReactNode }) {
  return (
    <details className="group overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition hover:bg-surface-container-low">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined text-xl">{icon}</span></span>
          <span className="min-w-0"><span className="block font-h3 text-sm text-primary">{title}</span><span className="block truncate text-xs text-on-surface-variant">{meta}</span></span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  )
}
