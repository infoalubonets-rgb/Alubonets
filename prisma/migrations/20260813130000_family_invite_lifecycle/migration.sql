CREATE TYPE "FamilyTransitionType" AS ENUM ('RECORD_CREATED', 'INVITED', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');
ALTER TABLE "family_invites" ADD COLUMN "revokedAt" TIMESTAMP(3);
CREATE TABLE "family_account_transitions" (
  "id" TEXT NOT NULL, "memberId" TEXT NOT NULL, "actorId" TEXT, "inviteId" TEXT,
  "type" "FamilyTransitionType" NOT NULL, "fromState" "FamilyRegistrationState" NOT NULL,
  "toState" "FamilyRegistrationState" NOT NULL, "adulthoodAge" INTEGER,
  "dateOfBirth" TIMESTAMP(3), "reason" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "family_account_transitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "family_account_transitions_memberId_occurredAt_idx" ON "family_account_transitions"("memberId", "occurredAt");
CREATE INDEX "family_account_transitions_inviteId_idx" ON "family_account_transitions"("inviteId");
ALTER TABLE "family_account_transitions" ADD CONSTRAINT "family_account_transitions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_account_transitions" ADD CONSTRAINT "family_account_transitions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
