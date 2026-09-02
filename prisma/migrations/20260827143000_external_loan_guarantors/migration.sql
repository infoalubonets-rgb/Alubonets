ALTER TABLE "loan_guarantors" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "residence" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "relationship" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "kraPin" TEXT;

CREATE INDEX IF NOT EXISTS "loan_guarantors_loanId_idNumber_idx"
  ON "loan_guarantors"("loanId", "idNumber");

UPDATE "app_settings"
SET "value" = '2', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'loan_min_guarantors' AND CAST("value" AS INTEGER) < 2;
