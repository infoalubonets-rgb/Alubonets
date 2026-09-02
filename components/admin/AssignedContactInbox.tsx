import { prisma } from '@/lib/prisma'
import { replyToContact, updateContactDestination, updateContactWorkflow } from '@/app/actions/contact'

export default async function AssignedContactInbox({ adminId }: { adminId: string }) {
  const [messages, setting] = await Promise.all([
    prisma.contactSubmission.findMany({
      where: { assignedToId: adminId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { replies: { orderBy: { sentAt: 'desc' } } },
    }),
    prisma.appSetting.findUnique({ where: { key: 'contact_destination_email' } }),
  ])
  const unread = messages.filter((message) => message.status === 'UNREAD').length

  return (
    <section className="space-y-4 rounded-2xl border bg-surface p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-h3 text-lg text-primary">Contact inbox</h2>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{unread} unread</span>
      </header>

      <form action={updateContactDestination} className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-container-low p-3">
        <label className="text-sm">Destination email<input name="email" type="email" required defaultValue={setting?.value || 'infoalubonets@gmail.com'} className="mt-1 block rounded-lg border px-3 py-2" /></label>
        <button className="rounded-full bg-primary px-4 py-2 text-on-primary">Save</button>
      </form>

      {messages.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">No enquiries assigned to you.</p>
      ) : messages.map((message) => (
        <article key={message.id} className="space-y-3 rounded-xl border bg-surface-container-low p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div><h3 className="font-bold">{message.name}</h3><p className="text-xs text-on-surface-variant">{message.email} · {message.phone || 'No phone'} · {message.createdAt.toLocaleString('en-KE')}</p></div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs">{message.status.replaceAll('_', ' ')}</span>
          </div>
          <p className="whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm">{message.message}</p>
          <form action={updateContactWorkflow} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={message.id} />
            <label className="text-xs">Status<select name="status" defaultValue={message.status} className="mt-1 block rounded-lg border px-2 py-2">{['UNREAD', 'IN_PROGRESS', 'RESOLVED', 'SPAM'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <button className="rounded-full border border-primary px-4 py-2 text-sm text-primary">Update</button>
            <a href={`mailto:${message.email}`} className="rounded-full border px-4 py-2 text-sm">Open email app</a>
          </form>
          <form action={replyToContact} className="grid gap-2 border-t pt-3">
            <input type="hidden" name="id" value={message.id} />
            <input name="subject" required defaultValue={`Re: ${message.category || 'Your Alubonets enquiry'}`} className="rounded-lg border px-3 py-2 text-sm" />
            <textarea name="body" required rows={3} placeholder="Write an email reply…" className="rounded-lg border px-3 py-2 text-sm" />
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Send reply</button>
          </form>
          {message.replies.length > 0 && <details><summary className="cursor-pointer text-sm text-primary">{message.replies.length} tracked repl{message.replies.length === 1 ? 'y' : 'ies'}</summary><div className="mt-2 space-y-2">{message.replies.map((reply) => <div key={reply.id} className="rounded-lg bg-surface p-3 text-sm"><b>{reply.subject}</b><p className="whitespace-pre-wrap">{reply.body}</p><small>{reply.sentAt.toLocaleString()} · {reply.deliveryStatus}</small></div>)}</div></details>}
        </article>
      ))}
    </section>
  )
}
