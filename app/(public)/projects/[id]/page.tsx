import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { submitProjectComment } from '@/app/actions/projects'
import { moneyNumber, projectFinanceVisibility } from '@/lib/projects'
import { getMemberAccess } from '@/lib/auth/member-access'
import MemberGate from '@/components/public/MemberGate'
import { fundingProgress, getProjectFinancials } from '@/lib/project-status'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id }, select: { title: true } })
  return { title: project ? `${project.title} — Alubonets` : 'Project' }
}

const STATUS_STYLES: Record<string, { label: string; classes: string; icon: string }> = {
  ONGOING: { label: 'Ongoing', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: 'sync' },
  COMPLETED: { label: 'Completed', classes: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300', icon: 'check_circle' },
  UPCOMING: { label: 'Upcoming', classes: 'bg-secondary-container/20 text-secondary-container dark:text-orange-400', icon: 'upcoming' },
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const profile = await getSessionProfile()
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      updates: { orderBy: { publishedAt: 'desc' }, take: 20 },
      comments: {
        where: { status: 'PUBLISHED' },
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      milestones: { orderBy: { position: 'asc' } },
    },
  })
  if (!project) notFound()
  const access = await getMemberAccess()
  if (access.state !== 'paid') {
    return (
      <main className="flex-grow">
        <div className="mx-auto max-w-container-max px-md py-xl md:px-lg">
          {access.state === 'anonymous'
            ? <MemberGate variant="login" what="Projects" returnTo={`/projects/${project.id}`} />
            : <MemberGate variant="renew" what="Projects" reason={access.reason} />}
        </div>
      </main>
    )
  }

  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.UPCOMING
  const visibility = projectFinanceVisibility(profile?.role)
  const { raised } = await getProjectFinancials(project.id)
  const target = moneyNumber(project.fundingTargetKes)
  const percent = target > 0 ? fundingProgress(raised, target) ?? 0 : project.progress

  return (
    <main className="flex-grow bg-surface-container-lowest">
      {project.imageUrl ? (
        <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden">
          <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-md md:px-lg pb-xl max-w-container-max mx-auto">
            <Link href="/projects" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-[13px] mb-4 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              All projects
            </Link>
            <h1 className="font-h1-mobile text-h1-mobile md:font-h2 md:text-h2 text-white leading-tight max-w-3xl">
              {project.title}
            </h1>
          </div>
        </div>
      ) : (
        <div className="relative bg-gradient-to-br from-primary to-[#001435] py-xxl px-md md:px-lg overflow-hidden">
          <div className="max-w-container-max mx-auto relative">
            <Link href="/projects" className="inline-flex items-center gap-1.5 text-on-primary/60 hover:text-on-primary text-[13px] mb-6 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              All projects
            </Link>
            <h1 className="font-h1-mobile text-h1-mobile md:font-h2 md:text-h2 text-on-primary leading-tight max-w-3xl">
              {project.title}
            </h1>
          </div>
        </div>
      )}

      <div className="max-w-container-max mx-auto px-md md:px-lg py-xl">
        <div className="grid md:grid-cols-3 gap-xl">
          <div className="md:col-span-2 space-y-lg">
            <div className="space-y-4">
              {project.description.split('\n').map((p, i) => (
                <p key={i} className="text-[15px] text-on-surface-variant leading-relaxed">{p}</p>
              ))}
            </div>

            {project.updates.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-h3 text-xl text-primary">Updates</h2>
                {project.updates.map((u) => (
                  <article key={u.id} className="rounded-2xl border bg-surface p-4">
                    <b>{u.title}</b>
                    <p className="text-xs text-on-surface-variant">{u.publishedAt.toLocaleString()}</p>
                    <p className="mt-2 whitespace-pre-line text-sm">{u.body}</p>
                  </article>
                ))}
              </section>
            )}

            {project.milestones.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-h3 text-xl text-primary">Milestones</h2>
                <ul className="space-y-2">
                  {project.milestones.map((m) => (
                    <li key={m.id} className="rounded-xl border bg-surface px-4 py-3 text-sm">
                      {m.completedAt ? '✓ ' : '○ '}
                      {m.title}
                      {m.dueAt ? ` · due ${m.dueAt.toLocaleDateString()}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="font-h3 text-xl text-primary">Comments</h2>
              {project.comments.map((c) => (
                <article key={c.id} className="rounded-2xl border bg-surface p-4 text-sm">
                  <b>{c.author.fullName}</b>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                </article>
              ))}
              {!project.comments.length && (
                <p className="text-sm text-on-surface-variant">No published comments yet.</p>
              )}
              {profile?.status === 'ACTIVE' ? (
                <form action={submitProjectComment} className="rounded-2xl border bg-surface p-4 space-y-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <textarea
                    name="body"
                    required
                    minLength={2}
                    placeholder="Share a comment (pending moderation)"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={3}
                  />
                  <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">
                    Submit comment
                  </button>
                </form>
              ) : (
                <p className="text-sm">
                  <Link href="/login" className="text-primary underline">
                    Sign in
                  </Link>{' '}
                  as an active member to comment.
                </p>
              )}
            </section>
          </div>

          <aside>
            <div className="rounded-2xl border border-outline-variant bg-surface p-5 space-y-4 shadow-sm sticky top-6">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold ${status.classes}`}>
                <span className="material-symbols-outlined icon-fill" style={{ fontSize: 15 }}>{status.icon}</span>
                {status.label}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Progress</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-outline-variant/30">
                  <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-sm font-medium">
                  {percent}%{target > 0 ? ' of the funding target raised' : ''}
                </p>
              </div>

              {visibility !== 'public' && target > 0 && (
                <div className="border-t border-outline-variant/40 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Funding progress
                  </p>
                  <p className="mt-1 text-sm">
                    KES {raised.toLocaleString()} raised of {target.toLocaleString()}
                  </p>
                </div>
              )}

              {visibility === 'manager' && (
                <div className="space-y-1 border-t border-outline-variant/40 pt-3 text-sm">
                  <p>Budget: KES {moneyNumber(project.budgetKes).toLocaleString()}</p>
                  <p>Expenditure: KES {moneyNumber(project.actualExpenditureKes).toLocaleString()}</p>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-outline-variant/40">
                {project.startDate && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Start date</p>
                    <p className="text-[14px] font-medium">
                      {new Date(project.startDate).toLocaleDateString('en-KE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                {project.endDate && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">End date</p>
                    <p className="text-[14px] font-medium">
                      {new Date(project.endDate).toLocaleDateString('en-KE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
