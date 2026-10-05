-- Additive: members whose contribution rights an Admin removed follow their Principal's standing.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contributionExempt" BOOLEAN NOT NULL DEFAULT false;
