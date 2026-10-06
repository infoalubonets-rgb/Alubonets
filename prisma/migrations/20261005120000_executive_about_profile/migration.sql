-- Executives appear on the public About page only after an Admin publishes them from the Members page.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showOnAbout" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aboutTitle" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aboutOrder" INTEGER NOT NULL DEFAULT 0;
