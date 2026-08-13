-- CreateEnum
CREATE TYPE "FamilyRelationship" AS ENUM ('SPOUSE', 'SON', 'DAUGHTER', 'CHILD', 'DEPENDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FamilyRegistrationState" AS ENUM ('STANDARD', 'RECORD_ONLY', 'INVITED', 'ACTIVE_ATTACHED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "isPrincipal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "principalMemberId" TEXT;
ALTER TABLE "users" ADD COLUMN "familyRelationship" "FamilyRelationship";
ALTER TABLE "users" ADD COLUMN "familyRegistrationState" "FamilyRegistrationState" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "family_invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_invites_token_key" ON "family_invites"("token");
CREATE INDEX "family_invites_userId_idx" ON "family_invites"("userId");
CREATE INDEX "family_invites_invitedById_idx" ON "family_invites"("invitedById");
CREATE INDEX "family_invites_email_idx" ON "family_invites"("email");
CREATE INDEX "users_principalMemberId_idx" ON "users"("principalMemberId");
CREATE INDEX "users_isPrincipal_idx" ON "users"("isPrincipal");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_principalMemberId_fkey" FOREIGN KEY ("principalMemberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
