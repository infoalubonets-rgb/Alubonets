-- Activities: optional subheading, image, and when members were emailed.
ALTER TABLE "daily_activities" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "daily_activities" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "daily_activities" ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3);
