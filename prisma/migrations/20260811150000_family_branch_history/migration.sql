-- Permanent history for every family-branch assignment and Admin transfer.
CREATE TABLE "family_branch_history" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fromPrincipalId" TEXT,
    "toPrincipalId" TEXT NOT NULL,
    "relationship" "FamilyRelationship" NOT NULL,
    "approvedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_branch_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "family_branch_history_memberId_effectiveAt_idx" ON "family_branch_history"("memberId", "effectiveAt");
CREATE INDEX "family_branch_history_fromPrincipalId_idx" ON "family_branch_history"("fromPrincipalId");
CREATE INDEX "family_branch_history_toPrincipalId_idx" ON "family_branch_history"("toPrincipalId");
CREATE INDEX "family_branch_history_approvedById_idx" ON "family_branch_history"("approvedById");

ALTER TABLE "users"
  ADD CONSTRAINT "users_family_self_link_check"
  CHECK ("principalMemberId" IS NULL OR "principalMemberId" <> "id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_principal_branch_shape_check"
  CHECK (
    ("isPrincipal" = true AND "principalMemberId" IS NULL AND "familyRelationship" IS NULL)
    OR
    ("isPrincipal" = false AND (
      ("principalMemberId" IS NULL AND "familyRelationship" IS NULL)
      OR
      ("principalMemberId" IS NOT NULL AND "familyRelationship" IS NOT NULL)
    ))
  );

ALTER TABLE "family_branch_history" ADD CONSTRAINT "family_branch_history_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_branch_history" ADD CONSTRAINT "family_branch_history_fromPrincipalId_fkey"
  FOREIGN KEY ("fromPrincipalId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_branch_history" ADD CONSTRAINT "family_branch_history_toPrincipalId_fkey"
  FOREIGN KEY ("toPrincipalId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_branch_history" ADD CONSTRAINT "family_branch_history_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the branch state that existed before this history table was added.
INSERT INTO "family_branch_history" (
  "id", "memberId", "fromPrincipalId", "toPrincipalId", "relationship", "approvedById", "reason", "effectiveAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || u."id"),
  u."id",
  NULL,
  u."principalMemberId",
  u."familyRelationship",
  u."principalMemberId",
  'Backfilled current branch assignment during hierarchy migration',
  COALESCE(u."updatedAt", CURRENT_TIMESTAMP)
FROM "users" u
WHERE u."principalMemberId" IS NOT NULL
  AND u."familyRelationship" IS NOT NULL;
