CREATE TYPE "DocumentAccessLevel" AS ENUM ('PUBLIC', 'MEMBERS', 'SELECTED_ROLES', 'ADMIN_SECRETARY');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');
CREATE TYPE "MeetingAudienceType" AS ENUM ('ALL_MEMBERS', 'SELECTED_ROLES', 'SELECTED_MEMBERS', 'MIXED');
CREATE TYPE "ActionPointStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');
ALTER TYPE "MeetingStatus" ADD VALUE 'NOTICE';
ALTER TYPE "MeetingStatus" ADD VALUE 'PENDING_APPROVAL';

ALTER TABLE "audit_logs"
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "newValue" JSONB,
  ADD COLUMN "oldValue" JSONB,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "userAgent" TEXT;

ALTER TABLE "documents"
  ADD COLUMN "accessLevel" "DocumentAccessLevel" NOT NULL DEFAULT 'MEMBERS',
  ADD COLUMN "allowedRoles" "Role"[] DEFAULT ARRAY[]::"Role"[],
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "effectiveAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "previousVersionId" TEXT,
  ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "versionGroupId" TEXT;

UPDATE "documents"
SET "versionGroupId" = id,
    "status" = 'PUBLISHED',
    "storagePath" = CASE WHEN "fileUrl" LIKE 'storage://documents/%' THEN substring("fileUrl" from 21) ELSE NULL END;
ALTER TABLE "documents" ALTER COLUMN "versionGroupId" SET NOT NULL;

ALTER TABLE "meetings"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "audienceRoles" "Role"[] DEFAULT ARRAY[]::"Role"[],
  ADD COLUMN "audienceType" "MeetingAudienceType" NOT NULL DEFAULT 'ALL_MEMBERS',
  ADD COLUMN "minutesVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "noticeBody" TEXT,
  ADD COLUMN "noticeSentAt" TIMESTAMP(3);

CREATE TABLE "document_categories" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);
INSERT INTO "document_categories" ("id","name") VALUES
  ('doc-cat-constitution','Constitution'),('doc-cat-policy','Policy'),('doc-cat-minutes','Minutes'),
  ('doc-cat-finance','Finance'),('doc-cat-project','Project'),('doc-cat-correspondence','Correspondence');
UPDATE "documents" d SET "categoryId" = c.id FROM "document_categories" c WHERE lower(d.category)=lower(c.name);

CREATE TABLE "document_downloads" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "ipAddress" TEXT, "userAgent" TEXT, "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_downloads_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "meeting_invitations" (
  "id" TEXT NOT NULL, "meetingId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3), "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_invitations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "meeting_agenda_items" (
  "id" TEXT NOT NULL, "meetingId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT,
  CONSTRAINT "meeting_agenda_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "meeting_action_points" (
  "id" TEXT NOT NULL, "meetingId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "ownerId" TEXT NOT NULL, "dueAt" TIMESTAMP(3), "status" "ActionPointStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meeting_action_points_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "meeting_decisions" (
  "id" TEXT NOT NULL, "meetingId" TEXT NOT NULL, "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL, "decision" TEXT NOT NULL, "decidedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_decisions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "meeting_versions" (
  "id" TEXT NOT NULL, "meetingId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL, "reason" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_categories_name_key" ON "document_categories"("name");
CREATE INDEX "document_downloads_documentId_downloadedAt_idx" ON "document_downloads"("documentId","downloadedAt");
CREATE UNIQUE INDEX "meeting_invitations_meetingId_userId_key" ON "meeting_invitations"("meetingId","userId");
CREATE UNIQUE INDEX "meeting_agenda_items_meetingId_position_key" ON "meeting_agenda_items"("meetingId","position");
CREATE INDEX "meeting_action_points_ownerId_status_idx" ON "meeting_action_points"("ownerId","status");
CREATE UNIQUE INDEX "meeting_decisions_reference_key" ON "meeting_decisions"("reference");
CREATE INDEX "meeting_decisions_decidedAt_idx" ON "meeting_decisions"("decidedAt");
CREATE UNIQUE INDEX "meeting_versions_meetingId_version_key" ON "meeting_versions"("meetingId","version");
CREATE UNIQUE INDEX "documents_previousVersionId_key" ON "documents"("previousVersionId");
CREATE INDEX "documents_versionGroupId_version_idx" ON "documents"("versionGroupId","version");
CREATE INDEX "documents_status_accessLevel_idx" ON "documents"("status","accessLevel");
CREATE INDEX "documents_categoryId_idx" ON "documents"("categoryId");

ALTER TABLE "documents" DROP CONSTRAINT "documents_uploadedBy_fkey";
ALTER TABLE "documents" ADD CONSTRAINT "documents_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_downloads" ADD CONSTRAINT "document_downloads_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_downloads" ADD CONSTRAINT "document_downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_invitations" ADD CONSTRAINT "meeting_invitations_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_invitations" ADD CONSTRAINT "meeting_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_action_points" ADD CONSTRAINT "meeting_action_points_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_action_points" ADD CONSTRAINT "meeting_action_points_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_action_points" ADD CONSTRAINT "meeting_action_points_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_versions" ADD CONSTRAINT "meeting_versions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('documents','documents',false,15728640,ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=15728640;
