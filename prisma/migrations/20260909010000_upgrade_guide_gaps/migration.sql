-- Upgrade guide gaps: privacy, activities, finance, calendar, security foundations

ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'DECEASED';
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'RESIGNED';
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'DISQUALIFIED';

ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "EventAudienceType" ADD VALUE IF NOT EXISTS 'BRANCH_MEMBERS';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

ALTER TABLE "contributions"
  ADD COLUMN IF NOT EXISTS "principalMemberId" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;

ALTER TABLE "contributions" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS "contributions_principalMemberId_idx" ON "contributions"("principalMemberId");

DO $$ BEGIN
  ALTER TABLE "contributions"
    ADD CONSTRAINT "contributions_principalMemberId_fkey"
    FOREIGN KEY ("principalMemberId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "transaction_categories"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fixedAmountKes" DOUBLE PRECISION;

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "audiencePrincipalId" TEXT;

CREATE INDEX IF NOT EXISTS "events_audiencePrincipalId_idx" ON "events"("audiencePrincipalId");

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_audiencePrincipalId_fkey"
    FOREIGN KEY ("audiencePrincipalId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT;

CREATE INDEX IF NOT EXISTS "meetings_eventId_idx" ON "meetings"("eventId");

DO $$ BEGIN
  ALTER TABLE "meetings"
    ADD CONSTRAINT "meetings_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "profile_visibility" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "visibleToMembers" BOOLEAN NOT NULL DEFAULT false,
  "allowedFields" JSONB NOT NULL DEFAULT '[]',
  "approvedByPrincipalId" TEXT,
  "changedById" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "profile_visibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_visibility_userId_key" ON "profile_visibility"("userId");
CREATE INDEX IF NOT EXISTS "profile_visibility_visibleToMembers_idx" ON "profile_visibility"("visibleToMembers");

DO $$ BEGIN
  ALTER TABLE "profile_visibility"
    ADD CONSTRAINT "profile_visibility_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "profile_visibility"
    ADD CONSTRAINT "profile_visibility_approvedByPrincipalId_fkey"
    FOREIGN KEY ("approvedByPrincipalId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "profile_visibility"
    ADD CONSTRAINT "profile_visibility_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "daily_activities" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "activityType" TEXT NOT NULL DEFAULT 'GENERAL',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "venue" TEXT,
  "audienceType" TEXT NOT NULL DEFAULT 'ALL_MEMBERS',
  "audienceRoles" "Role"[] DEFAULT ARRAY[]::"Role"[],
  "audiencePrincipalId" TEXT,
  "createdById" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "daily_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "daily_activities_startsAt_published_idx" ON "daily_activities"("startsAt", "published");

DO $$ BEGIN
  ALTER TABLE "daily_activities"
    ADD CONSTRAINT "daily_activities_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "finance_setting_versions" (
  "id" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "paybillOrTill" TEXT,
  "branchName" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "changedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_setting_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "finance_setting_versions_active_createdAt_idx" ON "finance_setting_versions"("active", "createdAt");

DO $$ BEGIN
  ALTER TABLE "finance_setting_versions"
    ADD CONSTRAINT "finance_setting_versions_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "fund_allocation_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "emergencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "reservePercent" DOUBLE PRECISION NOT NULL DEFAULT 80,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fund_allocation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fund_allocation_rules_active_idx" ON "fund_allocation_rules"("active");

INSERT INTO "fund_allocation_rules" ("id", "name", "emergencyPercent", "reservePercent", "active", "version", "notes", "createdAt", "updatedAt")
SELECT 'fund_rule_default', 'Constitutional default', 20, 80, true, 1, '20% emergency kitty / 80% reserve', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "fund_allocation_rules" WHERE "active" = true);

INSERT INTO "transaction_categories" ("id", "code", "name", "type", "description", "requiresEvidence", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('cat_funeral', 'FUNERAL', 'Funeral Support', 'INCOME', 'Life-event welfare', false, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_wedding', 'WEDDING', 'Wedding Support', 'INCOME', 'Life-event welfare', false, true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_dowry', 'DOWRY', 'Dowry Support', 'INCOME', 'Life-event welfare', false, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_medical', 'MEDICAL', 'Medical Emergency', 'INCOME', 'Health/welfare support', false, true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_education', 'EDUCATION', 'Education / Bursary', 'INCOME', 'Education and capacity-building', false, true, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_community', 'COMMUNITY', 'Community / Charity', 'INCOME', 'Approved external/community activity', false, true, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
