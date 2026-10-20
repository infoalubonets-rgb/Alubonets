import { prisma } from '@/lib/prisma'
import ContactInboxRows from '@/components/admin/ContactInboxRows'

export default async function AssignedContactInbox({
  adminId,
  isSuperAdmin = false,
}: {
  adminId: string
  isSuperAdmin?: boolean
}) {
  // Claim any unassigned enquiries so the Communications inbox is always usable.
  if (isSuperAdmin) {
    await prisma.contactSubmission.updateMany({
      where: { assignedToId: null },
      data: { assignedToId: adminId },
    })
  }

  // Every Super Admin sees every enquiry. Filtering by assignee hid messages from all but the
  // oldest Super Admin account, which every new enquiry is assigned to.
  const messages = await prisma.contactSubmission.findMany({
    where: isSuperAdmin ? {} : { assignedToId: adminId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { replies: { orderBy: { sentAt: 'desc' } } },
  })

  return (
    <ContactInboxRows
      messages={messages.map((message) => ({
        id: message.id,
        name: message.name,
        email: message.email,
        phone: message.phone,
        category: message.category,
        message: message.message,
        status: message.status,
        emailStatus: message.emailStatus,
        createdAt: message.createdAt.toISOString(),
        replies: message.replies.map((reply) => ({
          id: reply.id,
          subject: reply.subject,
          body: reply.body,
          sentAt: reply.sentAt.toISOString(),
          deliveryStatus: reply.deliveryStatus,
        })),
      }))}
    />
  )
}
