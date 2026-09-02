import { PrismaClient, PaymentMethod, ProjectStatus, Role, MemberStatus, WelfareStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Alubonets database...')

  // Audit logs are append-only in production DBs — do not wipe them during seed.
  await prisma.emailLog.deleteMany()
  await prisma.contribution.deleteMany()
  await prisma.welfareRequest.deleteMany()
  await prisma.galleryPhoto.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.document.deleteMany()
  await prisma.meeting.deleteMany()
  await prisma.event.deleteMany()
  await prisma.project.deleteMany()
  await prisma.familyInvite.deleteMany()
  await prisma.user.deleteMany()

  const admin = await prisma.user.create({
    data: {
      email: 'superadmin@alubonets.com',
      fullName: 'Super Administrator',
      phone: '+254700000001',
      role: Role.ADMIN,
      status: MemberStatus.ACTIVE,
      isSuperAdmin: true,
      dashboardAccess: [
        Role.ADMIN,
        Role.EXECUTIVE,
        Role.TREASURER,
        Role.SECRETARY,
        Role.ORGANIZER,
        Role.MEMBER,
      ],
    },
  })

  // Optional secondary admin (same powers except Super) — delete later if unused
  await prisma.user.create({
    data: {
      email: 'admin@alubonets.com',
      fullName: 'System Administrator',
      phone: '+254700000002',
      role: Role.ADMIN,
      status: MemberStatus.ACTIVE,
      isSuperAdmin: false,
      dashboardAccess: [Role.ADMIN],
    },
  })

  const executive = await prisma.user.create({
    data: {
      email: 'executive@alubonets.com',
      fullName: 'Executive Chair',
      role: Role.EXECUTIVE,
      status: MemberStatus.ACTIVE,
    },
  })

  const treasurer = await prisma.user.create({
    data: {
      email: 'treasurer@alubonets.com',
      fullName: 'Group Treasurer',
      role: Role.TREASURER,
      status: MemberStatus.ACTIVE,
    },
  })

  const secretary = await prisma.user.create({
    data: {
      email: 'secretary@alubonets.com',
      fullName: 'Group Secretary',
      role: Role.SECRETARY,
      status: MemberStatus.ACTIVE,
    },
  })

  const organizer = await prisma.user.create({
    data: {
      email: 'organizer@alubonets.com',
      fullName: 'Events Organizer',
      role: Role.ORGANIZER,
      status: MemberStatus.ACTIVE,
    },
  })

  const member = await prisma.user.create({
    data: {
      email: 'member@alubonets.com',
      fullName: 'Jane Member',
      phone: '+254700000099',
      role: Role.MEMBER,
      status: MemberStatus.ACTIVE,
    },
  })

  const principal = await prisma.user.create({
    data: {
      email: 'principal@alubonets.com',
      fullName: 'Principal Otieno',
      phone: '+254700000088',
      role: Role.MEMBER,
      status: MemberStatus.ACTIVE,
      isPrincipal: true,
      familyRegistrationState: 'STANDARD',
    },
  })

  const pending = await prisma.user.create({
    data: {
      email: 'pending@alubonets.com',
      fullName: 'Pending Applicant',
      role: Role.MEMBER,
      status: MemberStatus.PENDING,
    },
  })

  const members = [admin, executive, treasurer, secretary, organizer, member, principal]

  for (const [i, u] of members.entries()) {
    await prisma.contribution.create({
      data: {
        userId: u.id,
        amount: 1000 + i * 250,
        description: 'Monthly contribution',
        category: 'Monthly',
        paymentMethod: i % 2 === 0 ? PaymentMethod.MPESA : PaymentMethod.CASH,
        receivedBy: treasurer.fullName,
        mpesaRef: i % 2 === 0 ? `MPESA-${1000 + i}` : null,
        paidAt: new Date(Date.now() - i * 86400000 * 7),
      },
    })
  }

  await prisma.welfareRequest.create({
    data: {
      userId: member.id,
      description: 'Medical support for family member',
      amount: 15000,
      status: WelfareStatus.PENDING,
    },
  })

  await prisma.project.createMany({
    data: [
      {
        title: 'Community Borehole',
        description: 'Water access improvement for Alubokho families.',
        status: ProjectStatus.ONGOING,
        startDate: new Date('2026-01-15'),
      },
      {
        title: 'Youth Skills Workshop',
        description: 'Training program for members under 35.',
        status: ProjectStatus.UPCOMING,
        startDate: new Date('2026-08-01'),
      },
      {
        title: 'School Fees Support 2025',
        description: 'Completed bursary cycle.',
        status: ProjectStatus.COMPLETED,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      },
    ],
  })

  await prisma.announcement.create({
    data: {
      title: 'Welcome to the Alubonets platform',
      content: 'Members can now track contributions, welfare, and events online.',
      authorId: secretary.id,
    },
  })

  await prisma.event.createMany({
    data: [
      {
        id: 'seed-event-quarterly-meeting',
        title: 'Quarterly General Meeting',
        description: 'Review of finances and projects',
        location: 'Alubokho Community Hall',
        startsAt: new Date(Date.now() + 7 * 86400000),
        imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200',
      },
      {
        id: 'seed-event-family-day',
        title: 'Community Family Day',
        description: 'A completed day of sports, fellowship, and family activities.',
        location: 'Alubokho School Grounds',
        startsAt: new Date(Date.now() - 7 * 86400000),
      },
    ],
  })

  await prisma.galleryPhoto.createMany({
    data: [
      {
        url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800',
        caption: 'Family gathering 2025',
        category: 'Events',
        isPublic: true,
        approvedAt: new Date(),
        uploadedBy: organizer.id,
      },
      {
        url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
        caption: 'Pending approval upload',
        category: 'Projects',
        isPublic: false,
        uploadedBy: organizer.id,
      },
    ],
  })

  const prescribedCategories = [
    'Constitution',
    'Policy',
    'Minutes',
    'Finance',
    'Project',
    'Correspondence',
  ] as const
  for (const name of prescribedCategories) {
    await prisma.documentCategory.upsert({
      where: { name },
      create: { name, active: true },
      update: { active: true },
    })
  }
  const constitutionCategory = await prisma.documentCategory.findUniqueOrThrow({
    where: { name: 'Constitution' },
  })

  await prisma.document.create({
    data: {
      title: 'Constitution (summary)',
      fileUrl: '/documents/constitution-summary.pdf',
      category: 'Constitution',
      categoryId: constitutionCategory.id,
      uploadedBy: secretary.id,
      versionGroupId: 'seed-constitution',
      status: 'PUBLISHED',
      accessLevel: 'MEMBERS',
      effectiveAt: new Date(),
    },
  })

  await prisma.meeting.create({
    data: {
      title: 'January Executive Meeting',
      agenda: 'Budget review, welfare backlog, upcoming events',
      opening: 'The Chair called the meeting to order at 10:00.',
      minutes:
        'Budget for Q1 approved. Two welfare cases escalated to the treasurer for review.',
      resolutions: '1. Approve Q1 budget.\n2. Escalate welfare cases within 14 days.',
      location: 'Alubonets Hall, Nairobi',
      attendees: 'Executive Chair, Treasurer, Secretary, Organizer, and 8 members',
      nextMeetingAt: new Date('2026-02-17'),
      status: 'FINAL',
      heldAt: new Date('2026-01-20'),
      attendance: 12,
      recordedBy: secretary.id,
    },
  })

  await prisma.meeting.create({
    data: {
      title: 'February Planning Draft',
      agenda: 'Events calendar, gallery drive',
      opening: 'Draft notes — not yet finalized.',
      minutes: 'Organizer to propose three community events.',
      location: 'Virtual',
      status: 'DRAFT',
      heldAt: new Date('2026-02-10'),
      attendance: 6,
      recordedBy: secretary.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED',
      entity: 'database',
      meta: { pendingUserId: pending.id },
    },
  })

  console.log('Seed complete.')
  console.log('Profile emails (Auth via npm run db:bootstrap-auth):')
  console.log('- superadmin@alubonets.com (ADMIN / super)')
  console.log('- admin@alubonets.com (ADMIN)')
  console.log('- member@alubonets.com (MEMBER)')
  console.log('- principal@alubonets.com (MEMBER / Principal)')
  console.log('- pending@alubonets.com (PENDING)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
