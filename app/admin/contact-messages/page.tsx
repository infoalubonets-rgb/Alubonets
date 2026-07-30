import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import {
  deleteContactMessage,
  markContactMessageRead,
} from '@/app/actions/contact'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contact inbox — Alubonets' }

export default async function ContactMessagesPage() {
  await requireAdmin()
  const messages = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <DashboardShell role="ADMIN" title="Contact inbox" nav={ADMIN_NAV}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary">Contact messages</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Messages submitted through the public Contact Us form.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {messages.filter((message) => !message.readAt).length} unread
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-outline">inbox</span>
            <p className="mt-2 text-sm text-on-surface-variant">No contact messages yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-2xl border bg-surface p-4 ${
                  message.readAt
                    ? 'border-outline-variant'
                    : 'border-secondary-container shadow-sm'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-on-surface">{message.name}</h2>
                      {!message.readAt && (
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          New
                        </span>
                      )}
                      {message.category && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          {message.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                      <a className="hover:text-primary hover:underline" href={`mailto:${message.email}`}>
                        {message.email}
                      </a>
                      {message.phone && <span>{message.phone}</span>}
                      <span>{message.createdAt.toLocaleString('en-KE')}</span>
                      <span>Email: {message.emailStatus.replaceAll('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!message.readAt && (
                      <form action={markContactMessageRead}>
                        <input type="hidden" name="id" value={message.id} />
                        <button className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
                          Mark read
                        </button>
                      </form>
                    )}
                    <form action={deleteContactMessage}>
                      <input type="hidden" name="id" value={message.id} />
                      <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-container-low p-3 text-sm leading-relaxed text-on-surface">
                  {message.message}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
