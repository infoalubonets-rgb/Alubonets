-- Stage 5: project comments, investments, milestones, updates, documents, responsibles, finance fields

CREATE TYPE "ProjectCommentStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED');

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "budgetKes" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fundingTargetKes" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "actualExpenditureKes" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE TABLE IF NOT EXISTS "project_responsibles" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_responsibles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_comments" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "ProjectCommentStatus" NOT NULL DEFAULT 'PENDING',
  "moderatedById" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "moderationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_investments" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "investedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_investments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_milestones" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_updates" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_documents" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_responsibles_projectId_userId_key" ON "project_responsibles"("projectId", "userId");
CREATE INDEX IF NOT EXISTS "project_responsibles_userId_idx" ON "project_responsibles"("userId");
CREATE INDEX IF NOT EXISTS "project_comments_projectId_status_idx" ON "project_comments"("projectId", "status");
CREATE INDEX IF NOT EXISTS "project_comments_authorId_idx" ON "project_comments"("authorId");
CREATE INDEX IF NOT EXISTS "project_investments_projectId_investedAt_idx" ON "project_investments"("projectId", "investedAt");
CREATE INDEX IF NOT EXISTS "project_investments_userId_idx" ON "project_investments"("userId");
CREATE INDEX IF NOT EXISTS "project_milestones_projectId_position_idx" ON "project_milestones"("projectId", "position");
CREATE INDEX IF NOT EXISTS "project_updates_projectId_publishedAt_idx" ON "project_updates"("projectId", "publishedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "project_documents_projectId_documentId_key" ON "project_documents"("projectId", "documentId");
CREATE INDEX IF NOT EXISTS "project_documents_documentId_idx" ON "project_documents"("documentId");
CREATE INDEX IF NOT EXISTS "expenses_projectId_idx" ON "expenses"("projectId");

ALTER TABLE "project_responsibles"
  ADD CONSTRAINT "project_responsibles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_responsibles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_comments"
  ADD CONSTRAINT "project_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_comments_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_investments"
  ADD CONSTRAINT "project_investments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_investments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "project_investments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_milestones"
  ADD CONSTRAINT "project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_updates"
  ADD CONSTRAINT "project_updates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
