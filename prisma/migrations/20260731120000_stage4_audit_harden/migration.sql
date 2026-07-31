-- Stage 4.3: harden audit retention — keep logs when users are deleted; block app deletes via trigger except retention purge.

ALTER TABLE "audit_logs" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Audit logs are append-only. Use the retention purge cron to remove aged records.';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();
