'use client'

import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { friendlyError } from '@/lib/safe-error'
import {
  addProjectMilestone,
  addProjectResponsible,
  completeProjectMilestone,
  deleteProjectInvestment,
  linkProjectDocument,
  publishProjectUpdate,
  recordProjectInvestment,
  removeProjectResponsible,
  requestProjectDocumentUploadUrl,
  unlinkProjectDocument,
  updateProjectFinance,
  updateProjectSchedule,
  uploadProjectDocument,
} from '@/app/actions/projects'
import { uploadToSignedUrl } from '@/lib/upload-client'

export type ManageProject = {
  id: string
  startDate: string | null
  endDate: string | null
  budgetKes: number
  fundingTargetKes: number
  actualExpenditureKes: number
  responsibles: { id: string; label: string | null; fullName: string }[]
  investments: { id: string; amount: number; investedAt: string; notes: string | null; memberName: string }[]
  milestones: { id: string; title: string; dueAt: string | null; completedAt: string | null }[]
  updates: { id: string; title: string; body: string; publishedAt: string }[]
  documents: { id: string; documentId: string; title: string }[]
}

type Option = { id: string; label: string }
type Section = 'schedule' | 'finance' | 'investments' | 'team' | 'milestones' | 'updates' | 'documents'
type Action = (formData: FormData) => Promise<unknown>

const DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

const INPUT =
  'mt-1 block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
const LABEL = 'block text-xs font-semibold text-on-surface'
const PRIMARY =
  'inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-50'
const LINK_DANGER = 'text-xs font-semibold text-error hover:underline disabled:opacity-50'
const LINK_PRIMARY = 'text-xs font-semibold text-primary hover:underline disabled:opacity-50'

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '')
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString()
const kes = (value: number) => `KES ${value.toLocaleString()}`
const todayIso = () => new Date().toISOString().slice(0, 10)

type RunContext = {
  pending: boolean
  run: (action: Action, formData: FormData, success: string, onDone?: () => void) => void
}
const Ctx = createContext<RunContext | null>(null)

/** A form that calls a server action, shows the result in the open pop-up and refreshes the page. */
function ActionForm({
  action,
  success,
  reset = false,
  confirm,
  className,
  onReset,
  children,
}: {
  action: Action
  success: string
  reset?: boolean
  confirm?: string
  className?: string
  onReset?: () => void
  children: ReactNode
}) {
  const ctx = useContext(Ctx)!
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (confirm && !window.confirm(confirm)) return
    const form = e.currentTarget
    ctx.run(action, new FormData(form), success, reset ? () => form.reset() : undefined)
  }
  return (
    <form onSubmit={onSubmit} onReset={onReset} className={className}>
      {children}
    </form>
  )
}

function Submit({ children, className = PRIMARY }: { children: ReactNode; className?: string }) {
  const { pending } = useContext(Ctx)!
  return (
    <button type="submit" disabled={pending} className={className}>
      {children}
    </button>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-container-low px-3 py-4 text-center text-sm text-on-surface-variant">{children}</p>
}

async function uploadAndLinkDocument(formData: FormData) {
  const file = formData.get('file') as File | null
  if (!file?.size) throw new Error('Choose a document file.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Document must be 15 MB or smaller.')
  const request = new FormData()
  request.set('fileName', file.name)
  const { bucket, path, token, groupId } = await requestProjectDocumentUploadUrl(request)
  await uploadToSignedUrl(bucket, path, token, file)
  const submit = new FormData()
  submit.set('projectId', String(formData.get('projectId') || ''))
  submit.set('title', String(formData.get('title') || '').trim() || file.name.replace(/\.[^.]+$/, ''))
  submit.set('storagePath', path)
  submit.set('versionGroupId', groupId)
  await uploadProjectDocument(submit)
}

export default function ProjectManageTiles({
  project,
  members,
  documents,
}: {
  project: ManageProject
  members: Option[]
  documents: Option[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState<Section | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [fileName, setFileName] = useState('')

  const run: RunContext['run'] = (action, formData, success, onDone) => {
    setStatus(null)
    startTransition(async () => {
      try {
        await action(formData)
        onDone?.()
        setStatus({ ok: true, text: success })
        router.refresh()
      } catch (e) {
        setStatus({ ok: false, text: friendlyError(e, 'Could not save. Please check the details and try again.').message })
      }
    })
  }

  const show = (section: Section) => {
    setStatus(null)
    setOpen(section)
  }

  const done = project.milestones.filter((m) => m.completedAt).length
  const tiles: { id: Section; title: string; icon: string; meta: string }[] = [
    {
      id: 'schedule',
      title: 'Schedule',
      icon: 'calendar_month',
      meta: project.startDate && project.endDate ? `${fmtDate(project.startDate)} – ${fmtDate(project.endDate)}` : 'Set the start and end dates',
    },
    { id: 'finance', title: 'Financial settings', icon: 'account_balance_wallet', meta: 'Budget, funding target and expenditure' },
    { id: 'investments', title: 'Investments', icon: 'trending_up', meta: `${project.investments.length} recorded` },
    { id: 'team', title: 'Project team', icon: 'group', meta: `${project.responsibles.length} assigned` },
    { id: 'milestones', title: 'Milestones', icon: 'flag', meta: `${done}/${project.milestones.length} completed` },
    { id: 'updates', title: 'Project updates', icon: 'campaign', meta: `${project.updates.length} published` },
    { id: 'documents', title: 'Documents', icon: 'folder', meta: `${project.documents.length} linked` },
  ]
  const current = tiles.find((tile) => tile.id === open)

  return (
    <Ctx.Provider value={{ pending, run }}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => show(tile.id)}
            className="flex flex-col items-start gap-2 rounded-2xl border border-outline-variant/60 bg-surface p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <span className="material-symbols-outlined text-2xl text-primary">{tile.icon}</span>
            <span className="font-h3 text-lg text-primary">{tile.title}</span>
            <span className="text-xs text-on-surface-variant">{tile.meta}</span>
          </button>
        ))}
      </div>

      <FullScreenModal open={Boolean(current)} title={current?.title ?? ''} onClose={() => !pending && setOpen(null)} size="compact">
        <div className="space-y-4">
          {status && (
            <p
              role={status.ok ? 'status' : 'alert'}
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${status.ok ? 'bg-green-100 font-medium text-green-800' : 'bg-error-container/40 text-error'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{status.ok ? 'check_circle' : 'error'}</span>
              {status.text}
            </p>
          )}
          {pending && <p className="text-xs font-semibold text-secondary">Saving…</p>}

          {open === 'schedule' && (
            <ActionForm action={updateProjectSchedule} success="Dates saved — the project status follows them." className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="projectId" value={project.id} />
              <label className={LABEL}>
                Start date
                <input name="startDate" type="date" defaultValue={project.startDate?.slice(0, 10) ?? ''} className={INPUT} />
              </label>
              <label className={LABEL}>
                End date
                <input name="endDate" type="date" defaultValue={project.endDate?.slice(0, 10) ?? ''} className={INPUT} />
              </label>
              <div className="sm:col-span-2"><Submit>Save dates</Submit></div>
            </ActionForm>
          )}

          {open === 'finance' && (
            <ActionForm action={updateProjectFinance} success="Financial settings saved." className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="projectId" value={project.id} />
              <label className={LABEL}>
                Budget (KES)
                <input name="budgetKes" type="number" min={0} max={999999} step="0.01" defaultValue={project.budgetKes} className={INPUT} />
              </label>
              <label className={LABEL}>
                Funding target (KES)
                <input name="fundingTargetKes" type="number" min={0} max={999999} step="0.01" defaultValue={project.fundingTargetKes} className={INPUT} />
              </label>
              <label className={LABEL}>
                Actual expenditure (KES)
                <input name="actualExpenditureKes" type="number" min={0} max={999999} step="0.01" defaultValue={project.actualExpenditureKes} className={INPUT} />
              </label>
              <div className="sm:col-span-2"><Submit>Save finance</Submit></div>
            </ActionForm>
          )}

          {open === 'investments' && (
            <>
              <ActionForm action={recordProjectInvestment} success="Investment recorded." reset className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="projectId" value={project.id} />
                <label className={`${LABEL} sm:col-span-2`}>
                  Member
                  <select name="userId" required defaultValue="" className={INPUT}>
                    <option value="" disabled>Select a member</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <label className={LABEL}>
                  Amount (KES)
                  <input name="amount" type="number" min={1} max={999999} step="0.01" required className={INPUT} />
                </label>
                <label className={LABEL}>
                  Date
                  <input name="investedAt" type="date" max={todayIso()} title="An investment cannot be recorded with a future date." className={INPUT} />
                </label>
                <label className={`${LABEL} sm:col-span-2`}>
                  Notes
                  <input name="notes" className={INPUT} />
                </label>
                <div className="sm:col-span-2"><Submit>Add investment</Submit></div>
              </ActionForm>
              <h3 className="pt-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Recorded</h3>
              {project.investments.length === 0 ? <Empty>No investments yet.</Empty> : (
                <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {project.investments.map((row) => (
                    <li key={row.id} className="space-y-2 px-3 py-2.5 text-sm">
                      <p><span className="font-semibold">{row.memberName}</span> · {kes(row.amount)} · {fmtDate(row.investedAt)}</p>
                      {row.notes && <p className="text-xs text-on-surface-variant">{row.notes}</p>}
                      <ActionForm action={deleteProjectInvestment} success="Investment removed." confirm="Remove this investment?" className="flex items-center gap-2">
                        <input type="hidden" name="id" value={row.id} />
                        <input name="reason" required minLength={3} placeholder="Reason for removing" className="min-w-0 flex-1 rounded-lg border border-outline-variant px-2 py-1 text-xs" />
                        <Submit className={LINK_DANGER}>Remove</Submit>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {open === 'team' && (
            <>
              <ActionForm action={addProjectResponsible} success="Team member added." reset className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="projectId" value={project.id} />
                <label className={LABEL}>
                  Member
                  <select name="userId" required defaultValue="" className={INPUT}>
                    <option value="" disabled>Select a member</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <label className={LABEL}>
                  Role on the project
                  <input name="label" placeholder="e.g. Lead" className={INPUT} />
                </label>
                <Submit>Add</Submit>
              </ActionForm>
              {project.responsibles.length === 0 ? <Empty>No one assigned yet.</Empty> : (
                <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {project.responsibles.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span><span className="font-semibold">{row.fullName}</span>{row.label ? ` · ${row.label}` : ''}</span>
                      <ActionForm action={removeProjectResponsible} success={`${row.fullName} removed from the team.`} confirm={`Remove ${row.fullName} from the project team?`}>
                        <input type="hidden" name="id" value={row.id} />
                        <Submit className={LINK_DANGER}>Remove</Submit>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {open === 'milestones' && (
            <>
              <ActionForm action={addProjectMilestone} success="Milestone added." reset className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="projectId" value={project.id} />
                <label className={`${LABEL} sm:col-span-2`}>
                  Title
                  <input name="title" required minLength={2} className={INPUT} />
                </label>
                <label className={LABEL}>
                  Description
                  <input name="description" className={INPUT} />
                </label>
                <label className={LABEL}>
                  Due date
                  <input name="dueAt" type="date" min={todayIso()} title="A milestone cannot be due in the past." className={INPUT} />
                </label>
                <div className="sm:col-span-2"><Submit>Add milestone</Submit></div>
              </ActionForm>
              {project.milestones.length === 0 ? <Empty>No milestones yet.</Empty> : (
                <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {project.milestones.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[18px] ${m.completedAt ? 'text-green-700' : 'text-outline'}`}>
                          {m.completedAt ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={m.completedAt ? 'text-on-surface-variant line-through' : 'font-semibold'}>{m.title}</span>
                        {m.dueAt && <span className="text-xs text-on-surface-variant">due {fmtDate(m.dueAt)}</span>}
                      </span>
                      <ActionForm action={completeProjectMilestone} success={m.completedAt ? 'Milestone reopened.' : 'Milestone completed.'}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="complete" value={m.completedAt ? 'false' : 'true'} />
                        <Submit className={LINK_PRIMARY}>{m.completedAt ? 'Reopen' : 'Mark complete'}</Submit>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {open === 'updates' && (
            <>
              <ActionForm action={publishProjectUpdate} success="Update published." reset className="space-y-3">
                <input type="hidden" name="projectId" value={project.id} />
                <label className={LABEL}>
                  Title
                  <input name="title" required minLength={2} className={INPUT} />
                </label>
                <label className={LABEL}>
                  Update
                  <textarea name="body" required minLength={2} rows={4} className={INPUT} />
                </label>
                <Submit>Publish</Submit>
              </ActionForm>
              {project.updates.length === 0 ? <Empty>No updates published yet.</Empty> : (
                <ul className="space-y-2">
                  {project.updates.map((u) => (
                    <li key={u.id} className="rounded-xl border border-outline-variant px-3 py-2.5 text-sm">
                      <p className="font-semibold">{u.title}</p>
                      <p className="text-xs text-on-surface-variant">{fmtDateTime(u.publishedAt)}</p>
                      <p className="mt-1 whitespace-pre-line">{u.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {open === 'documents' && (
            <>
              <ActionForm
                action={uploadAndLinkDocument}
                success="Document uploaded and linked."
                reset
                onReset={() => setFileName('')}
                className="grid gap-3 rounded-xl border border-outline-variant p-3 sm:grid-cols-2"
              >
                <input type="hidden" name="projectId" value={project.id} />
                <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant sm:col-span-2">Upload a new document</h3>
                <label className={`${LABEL} sm:col-span-2`}>
                  Title <span className="font-normal text-on-surface-variant">(optional — defaults to the file name)</span>
                  <input name="title" maxLength={180} className={INPUT} />
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-outline-variant px-3 py-3 transition hover:border-primary/50 hover:bg-primary/[0.03] sm:col-span-2">
                  <span className="material-symbols-outlined text-[22px] text-primary">upload_file</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-on-surface">{fileName || 'Choose a file'}</span>
                    <span className="block text-xs text-on-surface-variant">PDF, Word, Excel or CSV · up to 15 MB</span>
                  </span>
                  <input
                    name="file"
                    type="file"
                    required
                    accept={DOC_ACCEPT}
                    className="sr-only"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                  />
                </label>
                <div className="sm:col-span-2"><Submit>Upload and link</Submit></div>
              </ActionForm>
              {documents.length > 0 && (
                <ActionForm action={linkProjectDocument} success="Document linked." className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <label className={`${LABEL} min-w-0 flex-1`}>
                    Or link an existing document
                    <select name="documentId" required defaultValue="" className={INPUT}>
                      <option value="" disabled>Select a document</option>
                      {documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </label>
                  <Submit>Link document</Submit>
                </ActionForm>
              )}
              {project.documents.length === 0 ? <Empty>No documents linked yet.</Empty> : (
                <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {project.documents.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <a href={`/api/documents/${row.documentId}/download`} className="truncate font-semibold text-primary hover:underline">{row.title}</a>
                      <ActionForm action={unlinkProjectDocument} success="Document unlinked." confirm={`Unlink “${row.title}” from this project?`}>
                        <input type="hidden" name="id" value={row.id} />
                        <Submit className={LINK_DANGER}>Unlink</Submit>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

        </div>
      </FullScreenModal>
    </Ctx.Provider>
  )
}
