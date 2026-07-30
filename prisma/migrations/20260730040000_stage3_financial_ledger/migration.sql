CREATE TYPE "TransactionStatus" AS ENUM ('PENDING','CONFIRMED','RECONCILED','REVERSED');
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED','MATCHED','RECONCILED','DISPUTED');
CREATE TYPE "AccountType" AS ENUM ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE');
CREATE TYPE "TransactionType" AS ENUM ('CONTRIBUTION','EXPENSE','DISBURSEMENT','ADJUSTMENT','REVERSAL','TRANSFER','OPENING_BALANCE');
CREATE TYPE "CategoryType" AS ENUM ('INCOME','EXPENSE','BOTH');
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN','CLOSED');
CREATE TYPE "ObligationStatus" AS ENUM ('OUTSTANDING','PARTIALLY_PAID','PAID','WAIVED');
CREATE TYPE "PaymentEventStatus" AS ENUM ('UNMATCHED','MATCHED','DUPLICATE','IGNORED');

ALTER TABLE "contributions" ADD COLUMN "campaignId" TEXT, ADD COLUMN "categoryId" TEXT, ADD COLUMN "contributionPeriod" TEXT, ADD COLUMN "correctionReason" TEXT, ADD COLUMN "financialTransactionId" TEXT, ADD COLUMN "reconciledAt" TIMESTAMP(3), ADD COLUMN "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED', ADD COLUMN "reversedById" TEXT, ADD COLUMN "sourceAccountId" TEXT, ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED';

CREATE TABLE "financial_accounts" ("id" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"type" "AccountType" NOT NULL,"description" TEXT,"restricted" BOOLEAN NOT NULL DEFAULT false,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id"));
CREATE TABLE "transaction_categories" ("id" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"type" "CategoryType" NOT NULL,"description" TEXT,"requiresEvidence" BOOLEAN NOT NULL DEFAULT false,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id"));
CREATE TABLE "accounting_periods" ("id" TEXT NOT NULL,"year" INTEGER NOT NULL,"month" INTEGER NOT NULL,"startsAt" TIMESTAMP(3) NOT NULL,"endsAt" TIMESTAMP(3) NOT NULL,"status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',"closedAt" TIMESTAMP(3),"closedBy" TEXT,CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id"));
CREATE TABLE "financial_transactions" ("id" TEXT NOT NULL,"transactionNumber" TEXT NOT NULL,"type" "TransactionType" NOT NULL,"status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',"amount" DECIMAL(14,2) NOT NULL,"description" TEXT NOT NULL,"occurredAt" TIMESTAMP(3) NOT NULL,"providerReference" TEXT,"correctionReason" TEXT,"categoryId" TEXT,"periodId" TEXT NOT NULL,"createdById" TEXT NOT NULL,"approvedById" TEXT,"confirmedAt" TIMESTAMP(3),"reconciledAt" TIMESTAMP(3),"reversedAt" TIMESTAMP(3),"originalTransactionId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ledger_entries" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"accountId" TEXT NOT NULL,"debit" DECIMAL(14,2) NOT NULL DEFAULT 0,"credit" DECIMAL(14,2) NOT NULL DEFAULT 0,"memo" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),CONSTRAINT "ledger_entry_one_side" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)));
CREATE TABLE "contribution_campaigns" ("id" TEXT NOT NULL,"title" TEXT NOT NULL,"description" TEXT,"targetAmount" DECIMAL(14,2) NOT NULL,"categoryId" TEXT NOT NULL,"startsAt" TIMESTAMP(3) NOT NULL,"dueAt" TIMESTAMP(3),"active" BOOLEAN NOT NULL DEFAULT true,"createdById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "contribution_campaigns_pkey" PRIMARY KEY ("id"));
CREATE TABLE "member_contribution_obligations" ("id" TEXT NOT NULL,"campaignId" TEXT NOT NULL,"userId" TEXT NOT NULL,"targetAmount" DECIMAL(14,2) NOT NULL,"status" "ObligationStatus" NOT NULL DEFAULT 'OUTSTANDING',"waivedReason" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "member_contribution_obligations_pkey" PRIMARY KEY ("id"));
CREATE TABLE "payment_events" ("id" TEXT NOT NULL,"provider" TEXT NOT NULL,"providerReference" TEXT NOT NULL,"amount" DECIMAL(14,2) NOT NULL,"phone" TEXT,"payerName" TEXT,"receivedAt" TIMESTAMP(3) NOT NULL,"rawPayload" JSONB,"status" "PaymentEventStatus" NOT NULL DEFAULT 'UNMATCHED',"matchedUserId" TEXT,"matchedContributionId" TEXT,"sourceAccountId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id"));
CREATE TABLE "reconciliations" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"paymentEventId" TEXT,"periodId" TEXT NOT NULL,"notes" TEXT NOT NULL,"reconciledById" TEXT NOT NULL,"reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id"));
CREATE TABLE "expenses" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"payee" TEXT NOT NULL,"purpose" TEXT NOT NULL,"approvalRequired" BOOLEAN NOT NULL DEFAULT false,CONSTRAINT "expenses_pkey" PRIMARY KEY ("id"));
CREATE TABLE "disbursements" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"beneficiary" TEXT NOT NULL,"purpose" TEXT NOT NULL,"welfareRequestId" TEXT,CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id"));
CREATE TABLE "adjustments" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"reason" TEXT NOT NULL,"oldValue" JSONB,"newValue" JSONB,CONSTRAINT "adjustments_pkey" PRIMARY KEY ("id"));
CREATE TABLE "supporting_documents" ("id" TEXT NOT NULL,"transactionId" TEXT,"contributionId" TEXT,"title" TEXT NOT NULL,"fileUrl" TEXT NOT NULL,"mimeType" TEXT NOT NULL,"uploadedById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "supporting_documents_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "financial_accounts_code_key" ON "financial_accounts"("code");
CREATE UNIQUE INDEX "transaction_categories_code_key" ON "transaction_categories"("code");
CREATE UNIQUE INDEX "accounting_periods_year_month_key" ON "accounting_periods"("year","month");
CREATE INDEX "accounting_periods_status_startsAt_idx" ON "accounting_periods"("status","startsAt");
CREATE UNIQUE INDEX "financial_transactions_transactionNumber_key" ON "financial_transactions"("transactionNumber");
CREATE UNIQUE INDEX "financial_transactions_providerReference_key" ON "financial_transactions"("providerReference");
CREATE INDEX "financial_transactions_occurredAt_status_idx" ON "financial_transactions"("occurredAt","status");
CREATE INDEX "financial_transactions_categoryId_occurredAt_idx" ON "financial_transactions"("categoryId","occurredAt");
CREATE INDEX "ledger_entries_accountId_createdAt_idx" ON "ledger_entries"("accountId","createdAt");
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");
CREATE INDEX "contribution_campaigns_active_startsAt_idx" ON "contribution_campaigns"("active","startsAt");
CREATE UNIQUE INDEX "member_contribution_obligations_campaignId_userId_key" ON "member_contribution_obligations"("campaignId","userId");
CREATE INDEX "member_contribution_obligations_userId_status_idx" ON "member_contribution_obligations"("userId","status");
CREATE UNIQUE INDEX "payment_events_providerReference_key" ON "payment_events"("providerReference");
CREATE INDEX "payment_events_status_receivedAt_idx" ON "payment_events"("status","receivedAt");
CREATE INDEX "payment_events_phone_receivedAt_idx" ON "payment_events"("phone","receivedAt");
CREATE UNIQUE INDEX "reconciliations_transactionId_key" ON "reconciliations"("transactionId");
CREATE UNIQUE INDEX "reconciliations_paymentEventId_key" ON "reconciliations"("paymentEventId");
CREATE UNIQUE INDEX "expenses_transactionId_key" ON "expenses"("transactionId");
CREATE UNIQUE INDEX "disbursements_transactionId_key" ON "disbursements"("transactionId");
CREATE UNIQUE INDEX "adjustments_transactionId_key" ON "adjustments"("transactionId");
CREATE UNIQUE INDEX "contributions_financialTransactionId_key" ON "contributions"("financialTransactionId");
CREATE INDEX "contributions_status_reconciliationStatus_idx" ON "contributions"("status","reconciliationStatus");
CREATE INDEX "contributions_campaignId_userId_idx" ON "contributions"("campaignId","userId");

ALTER TABLE "contributions" ADD CONSTRAINT "contributions_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "contribution_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_originalTransactionId_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contribution_campaigns" ADD CONSTRAINT "contribution_campaigns_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_contribution_obligations" ADD CONSTRAINT "member_contribution_obligations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "contribution_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_contribution_obligations" ADD CONSTRAINT "member_contribution_obligations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_paymentEventId_fkey" FOREIGN KEY ("paymentEventId") REFERENCES "payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supporting_documents" ADD CONSTRAINT "supporting_documents_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supporting_documents" ADD CONSTRAINT "supporting_documents_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supporting_documents" ADD CONSTRAINT "supporting_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "financial_accounts" ("id","code","name","type","restricted","updatedAt") VALUES
('acct-cash','CASH','Cash on hand','ASSET',false,CURRENT_TIMESTAMP),
('acct-bank','BANK','Bank account','ASSET',false,CURRENT_TIMESTAMP),
('acct-mpesa','MPESA','M-Pesa collection account','ASSET',false,CURRENT_TIMESTAMP),
('acct-general','GENERAL_FUND','General operating fund','EQUITY',false,CURRENT_TIMESTAMP),
('acct-welfare','WELFARE_FUND','Welfare fund','EQUITY',true,CURRENT_TIMESTAMP),
('acct-project','PROJECT_FUND','Project fund','EQUITY',true,CURRENT_TIMESTAMP),
('acct-contribution-income','CONTRIBUTION_INCOME','Contribution income','INCOME',false,CURRENT_TIMESTAMP),
('acct-expense','GENERAL_EXPENSE','General expenditure','EXPENSE',false,CURRENT_TIMESTAMP);

INSERT INTO "transaction_categories" ("id","code","name","type","requiresEvidence","updatedAt") VALUES
('cat-monthly','MONTHLY','Monthly contribution','INCOME',false,CURRENT_TIMESTAMP),
('cat-welfare','WELFARE','Welfare contribution','INCOME',false,CURRENT_TIMESTAMP),
('cat-project','PROJECT','Project contribution','INCOME',false,CURRENT_TIMESTAMP),
('cat-special','SPECIAL','Special collection','INCOME',false,CURRENT_TIMESTAMP),
('cat-registration','REGISTRATION','Registration fee','INCOME',false,CURRENT_TIMESTAMP),
('cat-other-income','OTHER_INCOME','Other income','INCOME',false,CURRENT_TIMESTAMP),
('cat-general-expense','GENERAL_EXPENSE','General expense','EXPENSE',true,CURRENT_TIMESTAMP),
('cat-welfare-disbursement','WELFARE_DISBURSEMENT','Welfare disbursement','EXPENSE',true,CURRENT_TIMESTAMP),
('cat-project-spending','PROJECT_SPENDING','Project spending','EXPENSE',true,CURRENT_TIMESTAMP);

INSERT INTO "accounting_periods" ("id","year","month","startsAt","endsAt")
SELECT 'period-' || y || '-' || LPAD(m::text,2,'0'), y, m, make_date(y,m,1), (make_date(y,m,1) + interval '1 month - 1 millisecond')
FROM generate_series(2020,2035) y CROSS JOIN generate_series(1,12) m;

INSERT INTO "financial_transactions" ("id","transactionNumber","type","status","amount","description","occurredAt","categoryId","periodId","createdById","confirmedAt")
SELECT 'legacy-' || c."id", 'LEGACY-' || c."id", 'CONTRIBUTION', 'CONFIRMED', c."amount", COALESCE(c."description",'Legacy contribution'), c."paidAt",
CASE WHEN lower(COALESCE(c."category",'')) LIKE '%welfare%' THEN 'cat-welfare' WHEN lower(COALESCE(c."category",'')) LIKE '%project%' THEN 'cat-project' ELSE 'cat-other-income' END,
'period-' || EXTRACT(YEAR FROM c."paidAt")::int || '-' || LPAD(EXTRACT(MONTH FROM c."paidAt")::int::text,2,'0'), c."userId", c."createdAt" FROM "contributions" c;

INSERT INTO "ledger_entries" ("id","transactionId","accountId","debit","credit","memo")
SELECT 'legacy-debit-'||c."id",'legacy-'||c."id",CASE c."paymentMethod"::text WHEN 'MPESA' THEN 'acct-mpesa' WHEN 'BANK' THEN 'acct-bank' ELSE 'acct-cash' END,c."amount",0,'Legacy receipt' FROM "contributions" c;
INSERT INTO "ledger_entries" ("id","transactionId","accountId","debit","credit","memo")
SELECT 'legacy-credit-'||c."id",'legacy-'||c."id",'acct-contribution-income',0,c."amount",'Legacy contribution income' FROM "contributions" c;
UPDATE "contributions" SET "financialTransactionId"='legacy-'||"id", "sourceAccountId"=CASE "paymentMethod"::text WHEN 'MPESA' THEN 'acct-mpesa' WHEN 'BANK' THEN 'acct-bank' ELSE 'acct-cash' END, "categoryId"=CASE WHEN lower(COALESCE("category",'')) LIKE '%welfare%' THEN 'cat-welfare' WHEN lower(COALESCE("category",'')) LIKE '%project%' THEN 'cat-project' ELSE 'cat-other-income' END;

INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ('financial_approval_threshold_kes','50000',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_immutable_ledger_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ledger entries are immutable; create a reversal or adjustment'; END; $$;
CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE OR DELETE ON "ledger_entries" FOR EACH ROW EXECUTE FUNCTION prevent_immutable_ledger_change();

CREATE OR REPLACE FUNCTION protect_confirmed_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Financial transactions cannot be deleted';
  END IF;
  IF OLD.status IN ('CONFIRMED','RECONCILED','REVERSED') AND
    (NEW.amount<>OLD.amount OR NEW."occurredAt"<>OLD."occurredAt" OR NEW.type<>OLD.type OR NEW."createdById"<>OLD."createdById" OR NEW."periodId"<>OLD."periodId" OR COALESCE(NEW."providerReference",'')<>COALESCE(OLD."providerReference",''))
  THEN RAISE EXCEPTION 'Confirmed financial transactions are immutable; create a reversal or adjustment';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER financial_transactions_immutable BEFORE UPDATE OR DELETE ON "financial_transactions" FOR EACH ROW EXECUTE FUNCTION protect_confirmed_transaction();

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES
('financial-documents','financial-documents',false,5242880,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
