-- Stage 6: events RSVP/attendance + announcement delivery extensions

CREATE TYPE "EventAudienceType" AS ENUM ('PUBLIC', 'ALL_MEMBERS', 'SELECTED_ROLES', 'SELECTED_MEMBERS');
CREATE TYPE "EventRsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');
CREATE TYPE "AnnouncementDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "AnnouncementPublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT');

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "audienceType" "EventAudienceType" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "audienceRoles" "Role"[] DEFAULT ARRAY[]::"Role"[],
  ADD COLUMN IF NOT EXISTS "capacity" INTEGER,
  ADD COLUMN IF NOT EXISTS "rsvpDeadlineAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "budgetKes" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "actualCostKes" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reminderOffsetsHours" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "remindersSent" JSONB,
  ADD COLUMN IF NOT EXISTS "reportBody" TEXT,
  ADD COLUMN IF NOT EXISTS "reportPublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "galleryPhotoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "events" SET "audienceType" = CASE WHEN "isPublic" THEN 'PUBLIC'::"EventAudienceType" ELSE 'ALL_MEMBERS'::"EventAudienceType" END;

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "status" "AnnouncementPublishStatus" NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "audienceRoles" "Role"[] DEFAULT ARRAY[]::"Role"[],
  ADD COLUMN IF NOT EXISTS "familyBranch" TEXT,
  ADD COLUMN IF NOT EXISTS "templateKey" TEXT,
  ADD COLUMN IF NOT EXISTS "mandatory" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "announcement_receipts"
  ADD COLUMN IF NOT EXISTS "emailStatus" "AnnouncementDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "emailError" TEXT,
  ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "announcement_receipts" SET "emailStatus" = 'SENT' WHERE "emailStatus" = 'PENDING';

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

CREATE TABLE IF NOT EXISTS "announcement_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_templates_key_key" ON "announcement_templates"("key");

CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailOptional" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_preferences_userId_key" ON "user_notification_preferences"("userId");

CREATE TABLE IF NOT EXISTS "event_invitations" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_invitations_eventId_userId_key" ON "event_invitations"("eventId", "userId");

CREATE TABLE IF NOT EXISTS "event_rsvps" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "EventRsvpStatus" NOT NULL,
  "note" TEXT,
  "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_rsvps_eventId_userId_key" ON "event_rsvps"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "event_rsvps_eventId_status_idx" ON "event_rsvps"("eventId", "status");

CREATE TABLE IF NOT EXISTS "event_attendances" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "present" BOOLEAN NOT NULL DEFAULT true,
  "recordedById" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_attendances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_attendances_eventId_userId_key" ON "event_attendances"("eventId", "userId");

CREATE TABLE IF NOT EXISTS "event_attachments" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "storagePath" TEXT,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "event_attachments_eventId_idx" ON "event_attachments"("eventId");

CREATE TABLE IF NOT EXISTS "event_costs" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_costs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "event_costs_eventId_idx" ON "event_costs"("eventId");

CREATE INDEX IF NOT EXISTS "events_startsAt_idx" ON "events"("startsAt");
CREATE INDEX IF NOT EXISTS "events_isPublic_startsAt_idx" ON "events"("isPublic", "startsAt");
CREATE INDEX IF NOT EXISTS "announcements_status_scheduledFor_idx" ON "announcements"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "announcement_receipts_emailStatus_retryCount_idx" ON "announcement_receipts"("emailStatus", "retryCount");
CREATE INDEX IF NOT EXISTS "expenses_eventId_idx" ON "expenses"("eventId");

ALTER TABLE "user_notification_preferences"
  ADD CONSTRAINT "user_notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_invitations"
  ADD CONSTRAINT "event_invitations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_rsvps"
  ADD CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_attendances"
  ADD CONSTRAINT "event_attendances_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_attendances_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_attachments"
  ADD CONSTRAINT "event_attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_costs"
  ADD CONSTRAINT "event_costs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_costs_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "announcement_templates" ("id", "key", "name", "subject", "bodyHtml")
VALUES
  ('tmpl-general', 'general', 'General announcement', 'Alubonets update', '<p>{{content}}</p>'),
  ('tmpl-event', 'event_reminder', 'Event reminder', 'Reminder: {{title}}', '<p>This is a reminder for <strong>{{title}}</strong>.</p><p>{{content}}</p>')
ON CONFLICT ("key") DO NOTHING;
