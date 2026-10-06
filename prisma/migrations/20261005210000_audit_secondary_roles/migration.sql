-- Audit log: the actor's secondary roles (extra dashboard access) and the role used for the change.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actorSecondaryRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actingRole" TEXT;
