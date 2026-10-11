-- Each member pays either monthly or annually; standing checks only the matching dues.
DO $$ BEGIN
  CREATE TYPE "ContributionPlan" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contributionPlan" "ContributionPlan";

-- "Member Contribution" becomes the yearly "Annual Contribution" purpose.
UPDATE "transaction_categories"
SET "name" = 'Annual Contribution', "code" = 'ANNUAL_CONTRIBUTION', "billingKind" = 'ANNUAL', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cat-member-contribution';
