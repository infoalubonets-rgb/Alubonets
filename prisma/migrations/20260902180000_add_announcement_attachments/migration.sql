ALTER TYPE "AnnouncementPublishStatus" ADD VALUE 'SENDING';

CREATE TABLE "announcement_attachments" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcement_attachments_announcementId_idx" ON "announcement_attachments"("announcementId");
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
