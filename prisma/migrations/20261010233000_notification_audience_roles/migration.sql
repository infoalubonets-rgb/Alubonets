-- Role-specific notifications: each notice records which workspace(s) it belongs to.
ALTER TABLE "user_notifications"
  ADD COLUMN IF NOT EXISTS "audienceRoles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];

-- Backfill existing role work from where each notice links to.
UPDATE "user_notifications" SET "audienceRoles" = ARRAY['TREASURER']::"Role"[]
  WHERE "href" LIKE '/dashboard/treasurer/%' AND cardinality("audienceRoles") = 0;
UPDATE "user_notifications" SET "audienceRoles" = ARRAY['EXECUTIVE']::"Role"[]
  WHERE "href" LIKE '/dashboard/executive/%' AND cardinality("audienceRoles") = 0;
UPDATE "user_notifications" SET "audienceRoles" = ARRAY['ADMIN']::"Role"[]
  WHERE ("href" = '/admin' OR "href" LIKE '/admin/%') AND cardinality("audienceRoles") = 0;

-- Loan applications were sent as announcements to Treasurers and Admins.
UPDATE "announcements" SET "audienceRoles" = ARRAY['TREASURER']::"Role"[]
  WHERE "title" LIKE 'Loan application:%' AND cardinality(COALESCE("audienceRoles", ARRAY[]::"Role"[])) = 0;
