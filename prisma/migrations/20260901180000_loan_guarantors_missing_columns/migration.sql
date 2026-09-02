-- Repair: external guarantor columns partially missing from prior migration.
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "residence" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "relationship" TEXT;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "kraPin" TEXT;

CREATE INDEX IF NOT EXISTS "loan_guarantors_loanId_idNumber_idx"
  ON "loan_guarantors"("loanId", "idNumber");
