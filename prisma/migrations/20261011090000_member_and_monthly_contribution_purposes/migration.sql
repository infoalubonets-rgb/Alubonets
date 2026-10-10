-- Payment purposes the Treasurer picks when recording a member's payment.
-- Monthly Contribution counts towards membership standing (billed per month).
INSERT INTO "transaction_categories" ("id", "code", "name", "type", "active", "sortOrder", "billingKind", "createdAt", "updatedAt")
VALUES
  ('cat-monthly-contribution', 'MONTHLY', 'Monthly Contribution', 'INCOME', true, 1, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-member-contribution', 'MEMBER_CONTRIBUTION', 'Member Contribution', 'INCOME', true, 2, 'NONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "active" = true,
  "type" = EXCLUDED."type",
  "billingKind" = EXCLUDED."billingKind",
  "updatedAt" = CURRENT_TIMESTAMP;
