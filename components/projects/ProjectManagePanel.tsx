import Link from 'next/link'
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

export default function ProjectManagePanel({
  project,
  members,
  documents,
  manageBase,
  canModerate = false,
}: {
  project: ProjectDetail
  members: Member[]
  documents: Doc[]
  manageBase: string
  canModerate?: boolean
}) {
  const raised = project.investments.reduce((sum, row) => sum + moneyNumber(row.amount), 0)
  const target = moneyNumber(project.fundingTargetKes)

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={manageBase} className="text-sm text-primary underline">
            Back to projects
          </Link>
          <h1 className="font-h3 text-2xl text-primary">{project.title}</h1>
          <p className="text-sm text-on-surface-variant">
            {project.status} · Progress {project.progress}% · Raised KES {raised.toLocaleString()}
            {target > 0 ? ` / ${target.toLocaleString()}` : ''}
          </p>
        </div>
        <a
          href={`/api/export/projects/${project.id}`}
          className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-h3 text-lg text-primary">Finance</h2>
        <form action={updateProjectFinance} className="mt-3 grid gap-2 md:grid-cols-4">
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
          <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save finance</button>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Record investment</h2>
          <form action={recordProjectInvestment} className="mt-3 space-y-2">
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
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Responsibles</h2>
          <form action={addProjectResponsible} className="mt-3 flex flex-wrap gap-2">
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
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Milestones</h2>
          <form action={addProjectMilestone} className="mt-3 space-y-2">
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
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Publish update</h2>
          <form action={publishProjectUpdate} className="mt-3 space-y-2">
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
        </section>
      </div>

      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-h3 text-lg text-primary">Project documents</h2>
        <form action={linkProjectDocument} className="mt-3 flex flex-wrap gap-2">
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
      </section>

      {canModerate && (
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-h3 text-lg text-primary">Comment moderation</h2>
        <div className="mt-3 space-y-3">
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
          {!project.comments.length && <p className="text-sm">No comments yet.</p>}
        </div>
      </section>
      )}
    </div>
  )
}
