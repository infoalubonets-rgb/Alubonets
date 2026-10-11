-- Confirmed contributions recorded before the ledger existed (or by the old direct path)
-- get their ledger entry, so the ledger, balances and reports include every payment.
-- Insert-only and safe to re-run: rows that already have a ledger entry are skipped.
WITH orphans AS (
  SELECT c.*,
    CASE c."paymentMethod"::text WHEN 'MPESA' THEN 'acct-mpesa' WHEN 'BANK' THEN 'acct-bank' ELSE 'acct-cash' END AS account_id,
    'period-' || EXTRACT(YEAR FROM c."paidAt")::int || '-' || LPAD(EXTRACT(MONTH FROM c."paidAt")::int::text, 2, '0') AS period_id
  FROM "contributions" c
  WHERE c."financialTransactionId" IS NULL AND c."status" IN ('CONFIRMED', 'RECONCILED')
)
INSERT INTO "financial_transactions"
  ("id", "transactionNumber", "type", "status", "amount", "description", "occurredAt", "providerReference",
   "categoryId", "periodId", "createdById", "confirmedAt", "addedAfterClose")
SELECT 'legacy-' || o."id", 'LEGACY-' || o."id", 'CONTRIBUTION', o."status"::text::"TransactionStatus", o."amount",
  COALESCE(o."description", 'Legacy contribution'), o."paidAt",
  CASE WHEN o."mpesaRef" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "financial_transactions" f WHERE f."providerReference" = o."mpesaRef") THEN o."mpesaRef" END,
  COALESCE(o."categoryId", 'cat-other-income'), o.period_id, o."userId", o."createdAt",
  COALESCE((SELECT p."status" = 'CLOSED' FROM "accounting_periods" p WHERE p."id" = o.period_id), false)
FROM orphans o
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ledger_entries" ("id", "transactionId", "accountId", "debit", "credit", "memo")
SELECT 'legacy-debit-' || c."id", 'legacy-' || c."id",
  CASE c."paymentMethod"::text WHEN 'MPESA' THEN 'acct-mpesa' WHEN 'BANK' THEN 'acct-bank' ELSE 'acct-cash' END,
  c."amount", 0, 'Legacy receipt'
FROM "contributions" c
WHERE c."financialTransactionId" IS NULL AND c."status" IN ('CONFIRMED', 'RECONCILED')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ledger_entries" ("id", "transactionId", "accountId", "debit", "credit", "memo")
SELECT 'legacy-credit-' || c."id", 'legacy-' || c."id", 'acct-contribution-income', 0, c."amount", 'Legacy contribution income'
FROM "contributions" c
WHERE c."financialTransactionId" IS NULL AND c."status" IN ('CONFIRMED', 'RECONCILED')
ON CONFLICT ("id") DO NOTHING;

UPDATE "contributions" c
SET "financialTransactionId" = 'legacy-' || c."id",
    "sourceAccountId" = COALESCE(c."sourceAccountId", CASE c."paymentMethod"::text WHEN 'MPESA' THEN 'acct-mpesa' WHEN 'BANK' THEN 'acct-bank' ELSE 'acct-cash' END),
    "categoryId" = COALESCE(c."categoryId", 'cat-other-income')
WHERE c."financialTransactionId" IS NULL AND c."status" IN ('CONFIRMED', 'RECONCILED')
  AND EXISTS (SELECT 1 FROM "financial_transactions" f WHERE f."id" = 'legacy-' || c."id");
