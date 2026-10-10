-- Separate M-Pesa Till / Paybill alongside the bank details.
ALTER TABLE "finance_setting_versions" ADD COLUMN IF NOT EXISTS "mpesaType" TEXT;
ALTER TABLE "finance_setting_versions" ADD COLUMN IF NOT EXISTS "mpesaNumber" TEXT;
ALTER TABLE "finance_setting_versions" ADD COLUMN IF NOT EXISTS "mpesaAccount" TEXT;
ALTER TABLE "finance_setting_versions" ADD COLUMN IF NOT EXISTS "mpesaName" TEXT;
