-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WelfareConfidentiality" AS ENUM ('STANDARD', 'CONFIDENTIAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaRecoveryCodes" TEXT;

-- AlterTable
ALTER TABLE "contributions"
  ADD COLUMN IF NOT EXISTS "allocationVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "emergencyPercent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reservePercent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "emergencyAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reserveAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "welfare_requests"
  ADD COLUMN IF NOT EXISTS "beneficiaryName" TEXT,
  ADD COLUMN IF NOT EXISTS "supportType" TEXT,
  ADD COLUMN IF NOT EXISTS "confidentiality" "WelfareConfidentiality" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "evidencePath" TEXT,
  ADD COLUMN IF NOT EXISTS "treasurerApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "treasurerApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "executiveApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "executiveApprovedById" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "welfare_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "welfare_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "type" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "welfare_decisions_requestId_createdAt_idx" ON "welfare_decisions"("requestId", "createdAt");
CREATE INDEX IF NOT EXISTS "user_notifications_userId_readAt_createdAt_idx" ON "user_notifications"("userId", "readAt", "createdAt");

DO $$ BEGIN
  ALTER TABLE "welfare_requests" ADD CONSTRAINT "welfare_requests_treasurerApprovedById_fkey" FOREIGN KEY ("treasurerApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "welfare_requests" ADD CONSTRAINT "welfare_requests_executiveApprovedById_fkey" FOREIGN KEY ("executiveApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "welfare_decisions" ADD CONSTRAINT "welfare_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "welfare_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "welfare_decisions" ADD CONSTRAINT "welfare_decisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
