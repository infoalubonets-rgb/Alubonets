'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { actionDeleteProject } from '@/app/actions/domain'
import UpsertProjectForm from './UpsertProjectForm'

type MemberOption = { id: string; fullName: string; email: string }

export type ProjectRow = {
  id: string
  title: string
  description: string
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED'
  imageUrl?: string | null
  progress: number
  updatedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  UPCOMING:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  ONGOING:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  COMPLETED: 'bg-surface-container dark:bg-[#1a2d4f] text-on-surface-variant dark:text-blue-200/60',
}

export default function OrganizerProjectsClient({
  projects: initialProjects,
  members,
}: {
  projects: ProjectRow[]
  members: MemberOption[]
}) {
  const [localProjects, setLocalProjects] = useState(initialProjects)
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<ProjectRow | null>(null)
  const [detail, setDetail]   = useState<ProjectRow | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { setLocalProjects(initialProjects) }, [initialProjects])

  function openCreate() { setEditing(null); setOpen(true) }
  function openEdit(p: ProjectRow) { setEditing(p); setOpen(true) }
  function closeModal() { setOpen(false); setEditing(null) }

  function handleDelete(id: string) {
    setLocalProjects((prev) => prev.filter((p) => p.id !== id))
    if (!id.startsWith('opt-')) startTransition(() => { actionDeleteProject(id) })
  }

  function handleSave(project: ProjectRow) {
    if (editing) {
      setLocalProjects((prev) => prev.map((p) => p.id === editing.id ? project : p))
    } else {
      setLocalProjects((prev) => [project, ...prev])
      // Trigger toast: project hits DB within ~2 s of form submit
      setTimeout(() => window.dispatchEvent(new CustomEvent('check-notifications')), 2500)
      // Bell re-fetch: retry at 4 s, 8 s, 12 s — one will catch after() completing + cache revalidation
      ;[4000, 8000, 12000].forEach((ms) =>
        setTimeout(() => window.dispatchEvent(new CustomEvent('new-announcement')), ms),
      )
    }
    closeModal()
  }

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50">
          {localProjects.length} project{localProjects.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary text-on-primary px-4 py-2 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined icon-fill" style={{ fontSize: 17 }}>add_circle</span>
          New project
        </button>
      </div>

      {/* Projects list */}
      {localProjects.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface-container-low dark:bg-[#0a1628] py-12 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30 dark:text-blue-200/20" style={{ fontSize: 40 }}>work_outline</span>
          <p className="text-[13px] text-on-surface-variant dark:text-blue-200/40 mt-2">No projects yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {localProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isPending={isPending}
              onView={() => setDetail(project)}
              onEdit={() => openEdit(project)}
              onDelete={() => handleDelete(project.id)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="relative w-full max-w-lg bg-surface dark:bg-[#0d1729] rounded-2xl shadow-2xl border border-outline-variant dark:border-[#1a2d4f] overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image / gradient header */}
            {detail.imageUrl ? (
              <div className="relative h-48 flex-shrink-0">
                <img src={detail.imageUrl} alt={detail.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
            ) : (
              <div className="relative h-28 bg-gradient-to-br from-primary to-[#001f50] flex-shrink-0 flex items-center px-5 gap-3">
                <span className="material-symbols-outlined icon-fill text-white/20 absolute right-4 text-[80px] select-none pointer-events-none">work</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/15 flex-shrink-0">
                  <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: 22 }}>work</span>
                </div>
                <h2 className="text-[17px] font-black text-white leading-snug line-clamp-2 flex-1">{detail.title}</h2>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {detail.imageUrl && (
                <h2 className="text-[18px] font-bold text-on-surface dark:text-blue-50">{detail.title}</h2>
              )}

              {/* Status + progress */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_COLORS[detail.status]}`}>
                  {detail.status}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <div className="flex-1 h-2 rounded-full bg-outline-variant/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${detail.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${detail.progress}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-bold text-on-surface dark:text-blue-50 flex-shrink-0">{detail.progress}%</span>
                </div>
              </div>

              <p className="text-[14px] text-on-surface-variant dark:text-blue-200/60 leading-relaxed whitespace-pre-wrap">
                {detail.description}
              </p>

              <p className="text-[11px] text-on-surface-variant/50">
                Updated {new Date(detail.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-outline-variant/30 dark:border-[#1a2d4f] flex-shrink-0">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="flex-1 rounded-xl border border-outline-variant dark:border-[#1a2d4f] bg-surface-container dark:bg-[#111f36] py-2.5 text-[13px] font-semibold text-on-surface dark:text-blue-50 transition-colors hover:bg-surface-container-high"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => { openEdit(detail); setDetail(null) }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                Edit project
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create / Edit modal */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>
                    {editing ? 'edit' : 'add_circle'}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">
                    {editing ? 'Edit project' : 'New project'}
                  </h2>
                  <p className="text-[11px] text-on-surface-variant dark:text-blue-200/50 truncate max-w-[220px]">
                    {editing ? editing.title : 'Fill in the project details'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1.5 hover:bg-surface-container dark:hover:bg-[#111f36] text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <UpsertProjectForm
              key={editing?.id ?? 'new'}
              members={members}
              initial={editing ?? undefined}
              onSuccess={handleSave}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function ProjectCard({
  project, isPending, onView, onEdit, onDelete,
}: {
  project: ProjectRow
  isPending: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const date = new Date(project.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-4 flex gap-4">
      {project.imageUrl && (
        <img src={project.imageUrl} alt={project.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-[14px] text-on-surface dark:text-blue-50 truncate">{project.title}</p>
            <p className="text-[12px] text-on-surface-variant dark:text-blue-200/50 mt-0.5 line-clamp-2">{project.description}</p>
          </div>
          <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}>
            {project.status}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-outline-variant/30 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${project.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-on-surface-variant dark:text-blue-200/50 flex-shrink-0">{project.progress}%</span>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[11px] text-on-surface-variant dark:text-blue-200/30">Updated {date}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onView}
              className="flex items-center gap-1 rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-2.5 py-1.5 text-[11px] font-semibold text-on-surface dark:text-blue-200 hover:border-primary/40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>visibility</span>
              View
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 rounded-lg border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-2.5 py-1.5 text-[11px] font-semibold text-on-surface dark:text-blue-200 hover:border-primary/40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
              Edit
            </button>
            {confirming ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => { setConfirming(false); onDelete() }}
                  className="rounded-lg bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-outline-variant bg-surface-container px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
