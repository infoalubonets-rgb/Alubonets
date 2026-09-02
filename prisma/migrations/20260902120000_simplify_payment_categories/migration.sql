-- Ensure a single "Other" system category for manual explanations.
INSERT INTO "transaction_categories" ("id", "code", "name", "type", "active", "createdAt", "updatedAt")
VALUES ('cat-other-income', 'OTHER', 'Other', 'BOTH', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "code" = 'OTHER', "name" = 'Other', "type" = 'BOTH', "active" = true, "updatedAt" = CURRENT_TIMESTAMP;

-- Retire legacy seed labels; admins add their own. System flows keep loan/welfare codes.
UPDATE "transaction_categories"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN (
  'MONTHLY',
  'WELFARE',
  'PROJECT',
  'SPECIAL',
  'REGISTRATION',
  'GENERAL_EXPENSE',
  'PROJECT_SPENDING'
);
