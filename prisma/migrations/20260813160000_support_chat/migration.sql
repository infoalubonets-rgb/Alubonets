CREATE TABLE "support_conversations" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "subject" TEXT, "closedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id"));
CREATE TABLE "support_messages" ("id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "body" TEXT NOT NULL, "readByAdminAt" TIMESTAMP(3), "readByMemberAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "support_conversations_userId_key" ON "support_conversations"("userId");
CREATE INDEX "support_conversations_updatedAt_idx" ON "support_conversations"("updatedAt");
CREATE INDEX "support_messages_conversationId_createdAt_idx" ON "support_messages"("conversationId", "createdAt");
CREATE INDEX "support_messages_readByAdminAt_createdAt_idx" ON "support_messages"("readByAdminAt", "createdAt");
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
