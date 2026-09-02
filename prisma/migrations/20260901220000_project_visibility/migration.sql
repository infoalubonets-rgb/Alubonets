ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "projects_isPublic_updatedAt_idx" ON "projects"("isPublic", "updatedAt");
