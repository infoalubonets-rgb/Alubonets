-- Read-only oversight role: sees financial records, reports and audit history, writes nothing.
-- ALTER TYPE ... ADD VALUE is additive and safe for existing rows.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUDITOR';
