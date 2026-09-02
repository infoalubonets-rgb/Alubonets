ALTER TABLE "resolutions" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'RESOLUTION';
ALTER TABLE "resolution_responses" ADD COLUMN IF NOT EXISTS "anonymous" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "resolutions_category_createdAt_idx" ON "resolutions"("category", "createdAt");

INSERT INTO "resolutions" (
  "id",
  "title",
  "body",
  "category",
  "status",
  "visibleToRoles",
  "createdById",
  "decidedById",
  "decidedAt",
  "resultsPublished",
  "createdAt",
  "updatedAt"
)
SELECT
  'gov-sample-welfare-budget',
  'Approve 2026 welfare budget ceiling',
  'Members are asked to approve raising the annual welfare disbursement ceiling from KES 30,000 to KES 50,000 per case, effective 1 July 2026. This supports timely assistance while keeping the welfare fund sustainable.',
  'RESOLUTION',
  'APPROVED',
  ARRAY['MEMBER','ADMIN','EXECUTIVE','TREASURER','SECRETARY','ORGANIZER']::"Role"[],
  u."id",
  u."id",
  CURRENT_TIMESTAMP,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."email" = 'superadmin@alubonets.com'
ON CONFLICT ("id") DO NOTHING;
