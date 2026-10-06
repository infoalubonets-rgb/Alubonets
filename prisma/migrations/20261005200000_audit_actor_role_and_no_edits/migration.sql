-- Audit log: record the actor's primary role and flag changes made outside it; block edits.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actorRole" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "outsideRole" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "audit_logs_outsideRole_createdAt_idx" ON "audit_logs"("outsideRole", "createdAt");

-- Entries are append-only: nothing may rewrite one after it is written.
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Deleting a member sets userId to NULL (ON DELETE SET NULL); that is the only change allowed.
  IF NEW."userId" IS NULL AND OLD."userId" IS NOT NULL
     AND (to_jsonb(NEW) - 'userId') = (to_jsonb(OLD) - 'userId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Audit logs are append-only and cannot be edited.';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_update();
