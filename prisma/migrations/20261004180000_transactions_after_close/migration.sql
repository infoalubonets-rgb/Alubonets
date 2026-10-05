-- Months close automatically; entries are still allowed and tagged when added or changed after close.
ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "addedAfterClose" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "editedAfterClose" BOOLEAN NOT NULL DEFAULT false;
