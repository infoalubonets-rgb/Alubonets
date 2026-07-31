import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireAdmin } from '@/lib/auth/session'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import {
  createTargetedAnnouncement,
  retryFailedAnnouncementEmails,
  upsertAnnouncementTemplate,
  updateNotificationPreferences,
} from '@/app/actions/announcements'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

export default async function AdminAnnouncementsPage() {
  const actor = await requireAdmin()
  const [announcements, templates, members, branches, pref] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        receipts: { select: { emailStatus: true } },
        author: { select: { fullName: true } },
      },
    }),
    prisma.announcementTemplate.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.memberProfile.findMany({
      where: { familyBranch: { not: null } },
      select: { familyBranch: true },
      distinct: ['familyBranch'],
    }),
    prisma.userNotificationPreference.findUnique({ where: { userId: actor.id } }),
  ])

  return (
    <DashboardShell role="ADMIN" title="Announcements & email" nav={ADMIN_NAV}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Send / schedule announcement</h2>
          <form action={createTargetedAnnouncement} className="mt-3 grid gap-2 md:grid-cols-2">
            <input name="title" required placeholder="Title" className="rounded-lg border px-3 py-2" />
            <select name="templateKey" className="rounded-lg border px-3 py-2">
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
            <textarea name="content" required placeholder="Content" className="rounded-lg border px-3 py-2 md:col-span-2" rows={4} />
            <input name="scheduledFor" type="datetime-local" className="rounded-lg border px-3 py-2" />
            <select name="familyBranch" className="rounded-lg border px-3 py-2">
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.familyBranch!} value={b.familyBranch!}>
                  {b.familyBranch}
                </option>
              ))}
            </select>
            <fieldset className="flex flex-wrap gap-2 text-xs md:col-span-2">
              {ROLES.map((role) => (
                <label key={role}>
                  <input type="checkbox" name="audienceRoles" value={role} /> {role}
                </label>
              ))}
            </fieldset>
            <select name="memberIds" multiple className="h-28 rounded-lg border px-2 md:col-span-2">
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <label className="text-sm">
              <input type="checkbox" name="sendEmail" defaultChecked /> Send email
            </label>
            <label className="text-sm">
              <input type="checkbox" name="mandatory" /> Mandatory (ignore email opt-out)
            </label>
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Publish / schedule</button>
          </form>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Your email preference</h2>
          <form action={updateNotificationPreferences} className="mt-2 flex items-center gap-3">
            <label className="text-sm">
              <input type="checkbox" name="emailOptional" defaultChecked={pref?.emailOptional !== false} />{' '}
              Receive optional announcement emails
            </label>
            <button className="text-sm text-primary underline">Save</button>
          </form>
          <p className="mt-1 text-xs text-on-surface-variant">Mandatory governance/finance notices always send.</p>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Templates</h2>
          <form action={upsertAnnouncementTemplate} className="mt-3 grid gap-2 md:grid-cols-2">
            <input name="key" required placeholder="key e.g. welcome" className="rounded-lg border px-3 py-2" />
            <input name="name" required placeholder="Display name" className="rounded-lg border px-3 py-2" />
            <input name="subject" required placeholder="Email subject" className="rounded-lg border px-3 py-2 md:col-span-2" />
            <textarea name="bodyHtml" required placeholder="HTML body ({{title}}, {{content}})" className="rounded-lg border px-3 py-2 md:col-span-2" rows={3} />
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save template</button>
          </form>
          <ul className="mt-3 space-y-1 text-sm">
            {templates.map((t) => (
              <li key={t.id}>
                <b>{t.key}</b> — {t.name}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Recent announcements & delivery</h2>
          <div className="mt-3 space-y-3">
            {announcements.map((a) => {
              const failed = a.receipts.filter((r) => r.emailStatus === 'FAILED').length
              const sent = a.receipts.filter((r) => r.emailStatus === 'SENT').length
              return (
                <article key={a.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <b>{a.title}</b> · {a.status}
                      <p className="text-xs text-on-surface-variant">
                        {a.author.fullName} · {a.createdAt.toLocaleString()} · email sent {sent} · failed {failed}
                      </p>
                    </div>
                    {failed > 0 && (
                      <form action={retryFailedAnnouncementEmails}>
                        <input type="hidden" name="announcementId" value={a.id} />
                        <button className="text-primary underline">Retry failed emails</button>
                      </form>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
