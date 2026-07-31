-- Stage 8 settings + Stage 7 simple loans

CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CLOSED');
CREATE TYPE "LoanGuarantorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "LoanLedgerKind" AS ENUM ('DISBURSEMENT', 'REPAYMENT');

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

INSERT INTO "feature_flags" ("key", "enabled") VALUES ('loans_enabled', false)
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "welfare_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "welfare_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_classes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_classes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "welfare_requests" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

DO $$ BEGIN
  ALTER TABLE "welfare_requests" ADD CONSTRAINT "welfare_requests_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "welfare_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "project_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "welfare_requests_categoryId_idx" ON "welfare_requests"("categoryId");
CREATE INDEX IF NOT EXISTS "projects_categoryId_idx" ON "projects"("categoryId");

INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES
  ('password_min_length', '8', CURRENT_TIMESTAMP),
  ('password_require_mixed', 'false', CURRENT_TIMESTAMP),
  ('audit_retention_days', '365', CURRENT_TIMESTAMP),
  ('branding_site_name', 'Alubonets', CURRENT_TIMESTAMP),
  ('branding_primary_hex', '#003366', CURRENT_TIMESTAMP),
  ('loan_max_amount_kes', '50000', CURRENT_TIMESTAMP),
  ('loan_min_guarantors', '1', CURRENT_TIMESTAMP),
  ('loan_require_guarantor_accept', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "loan_applications" (
  "id" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "amountKes" DECIMAL(14,2) NOT NULL,
  "purpose" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "installmentNotes" TEXT,
  "notes" TEXT,
  "status" "LoanApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "treasurerNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "disbursedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "loan_guarantors" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "LoanGuarantorStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_guarantors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "loan_ledger_links" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "kind" "LoanLedgerKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_ledger_links_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "loan_ledger_links" ADD CONSTRAINT "loan_ledger_links_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "loan_ledger_links" ADD CONSTRAINT "loan_ledger_links_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "loan_guarantors_loanId_userId_key" ON "loan_guarantors"("loanId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_ledger_links_transactionId_key" ON "loan_ledger_links"("transactionId");
CREATE INDEX IF NOT EXISTS "loan_applications_applicantId_status_idx" ON "loan_applications"("applicantId", "status");
CREATE INDEX IF NOT EXISTS "loan_applications_status_createdAt_idx" ON "loan_applications"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "loan_guarantors_userId_status_idx" ON "loan_guarantors"("userId", "status");
CREATE INDEX IF NOT EXISTS "loan_ledger_links_loanId_kind_idx" ON "loan_ledger_links"("loanId", "kind");

INSERT INTO "transaction_categories" ("id", "code", "name", "type", "active", "createdAt", "updatedAt")
VALUES
  ('cat-loan-disbursement', 'LOAN_DISBURSEMENT', 'Loan disbursement', 'EXPENSE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-loan-repayment', 'LOAN_REPAYMENT', 'Loan repayment', 'INCOME', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
