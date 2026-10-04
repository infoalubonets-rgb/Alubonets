-- Sep 9 review meeting: membership standing, billing kinds, campaign per-member targets,
-- project-linked contributions, meeting attendance, committee profiles. Additive only.

DO $$ BEGIN
  CREATE TYPE "MemberStanding" AS ENUM ('PAID_UP', 'LAPSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingKind" AS ENUM ('NONE', 'MONTHLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingAttendanceStatus" AS ENUM ('PRESENT', 'APOLOGY', 'ABSENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users: paid-up standing + public profile fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "standing" "MemberStanding" NOT NULL DEFAULT 'PAID_UP';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "standingReason" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "standingCheckedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "standingOverride" "MemberStanding";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "standingOverrideUntil" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "publicProfileFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Categories: billing kind
ALTER TABLE "transaction_categories" ADD COLUMN IF NOT EXISTS "billingKind" "BillingKind" NOT NULL DEFAULT 'NONE';

-- Campaigns: optional per-member target (legacy targetAmount was per-member)
ALTER TABLE "contribution_campaigns" ADD COLUMN IF NOT EXISTS "perMemberTarget" DECIMAL(14,2);
UPDATE "contribution_campaigns" c
SET "perMemberTarget" = c."targetAmount",
    "targetAmount" = c."targetAmount" * GREATEST(
      (SELECT COUNT(*) FROM "member_contribution_obligations" o WHERE o."campaignId" = c."id"), 1)
WHERE c."perMemberTarget" IS NULL
  AND EXISTS (SELECT 1 FROM "member_contribution_obligations" o WHERE o."campaignId" = c."id");

-- Contributions: optional project link
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "contributions_projectId_idx" ON "contributions"("projectId");
DO $$ BEGIN
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Committee profiles: link to member + responsibilities
ALTER TABLE "committee_profiles" ADD COLUMN IF NOT EXISTS "responsibilities" TEXT;
ALTER TABLE "committee_profiles" ADD COLUMN IF NOT EXISTS "userId" TEXT;
DO $$ BEGIN
  ALTER TABLE "committee_profiles" ADD CONSTRAINT "committee_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Meeting attendance linked to members
CREATE TABLE IF NOT EXISTS "meeting_attendance" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "MeetingAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_attendance_meetingId_userId_key" ON "meeting_attendance"("meetingId", "userId");
CREATE INDEX IF NOT EXISTS "meeting_attendance_userId_idx" ON "meeting_attendance"("userId");
DO $$ BEGIN
  ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Default payment purposes
INSERT INTO "transaction_categories" ("id", "code", "name", "type", "active", "sortOrder", "billingKind", "createdAt", "updatedAt")
VALUES
  ('cat-project-contribution', 'PROJECT_CONTRIBUTION', 'Project', 'BOTH', true, 90, 'NONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-monthly-contribution', 'MONTHLY', 'Monthly Contribution', 'INCOME', true, 1, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-annual-subscription', 'ANNUAL_SUBSCRIPTION', 'Annual Subscription', 'INCOME', true, 2, 'ANNUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-funeral', 'FUNERAL', 'Funeral', 'INCOME', true, 3, 'NONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-registration', 'REGISTRATION', 'Registration', 'INCOME', true, 4, 'NONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "active" = true,
    "billingKind" = EXCLUDED."billingKind",
    "name" = CASE WHEN "transaction_categories"."code" = 'MONTHLY' THEN 'Monthly Contribution' ELSE "transaction_categories"."name" END,
    "updatedAt" = CURRENT_TIMESTAMP;
