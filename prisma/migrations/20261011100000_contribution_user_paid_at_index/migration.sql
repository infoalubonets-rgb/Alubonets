-- A member's payment history is read newest first.
CREATE INDEX IF NOT EXISTS "contributions_userId_paidAt_idx" ON "contributions"("userId", "paidAt");
