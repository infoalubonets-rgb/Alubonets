-- Member IDs move from ALU-2026-001 to AL2608-001 (approval year+month, 3-digit monthly counter),
-- and families get tags: Principal PJW (P + first-name and surname initials, PJW2 on a clash),
-- attached members PJW01, PJW02… in the order they joined. Safe to re-run.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "legacyMembershipNumber" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "familyCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "familyMemberNumber" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "users_familyCode_key" ON "users"("familyCode");
CREATE UNIQUE INDEX IF NOT EXISTS "users_principalMemberId_familyMemberNumber_key" ON "users"("principalMemberId", "familyMemberNumber");

-- 1. Keep the old number, then renumber by approval month in Kenya time (oldest first).
UPDATE "users" SET "legacyMembershipNumber" = "membershipNumber"
WHERE "membershipNumber" LIKE 'ALU-%' AND "legacyMembershipNumber" IS NULL;

WITH numbered AS (
  SELECT "id",
    (COALESCE("approvedAt", "createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi' AS local_at,
    row_number() OVER (
      PARTITION BY to_char((COALESCE("approvedAt", "createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'YYMM')
      ORDER BY COALESCE("approvedAt", "createdAt"), "createdAt", "id"
    ) AS rn
  FROM "users"
  WHERE "membershipNumber" LIKE 'ALU-%'
)
UPDATE "users" u
SET "membershipNumber" = 'AL' || to_char(n.local_at, 'YYMM') || '-' || lpad(n.rn::text, 3, '0')
FROM numbered n
WHERE u."id" = n."id";

-- Monthly counters continue from the highest number already used in each month (key YYYYMM).
INSERT INTO "membership_sequences" ("year", "lastValue", "updatedAt")
SELECT (2000 + substr("membershipNumber", 3, 2)::int) * 100 + substr("membershipNumber", 5, 2)::int,
       max(substr("membershipNumber", 8)::int),
       now()
FROM "users"
WHERE "membershipNumber" ~ '^AL[0-9]{4}-[0-9]{3,}$'
GROUP BY 1
ON CONFLICT ("year") DO UPDATE
SET "lastValue" = GREATEST("membership_sequences"."lastValue", EXCLUDED."lastValue"), "updatedAt" = now();

-- 2. Family codes.
CREATE OR REPLACE FUNCTION family_code_base(full_name TEXT) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  words TEXT[];
  first_word TEXT;
  last_word TEXT;
BEGIN
  words := array_remove(regexp_split_to_array(trim(regexp_replace(upper(COALESCE(full_name, '')), '[^A-Z[:space:]]', '', 'g')), '[[:space:]]+'), '');
  IF COALESCE(array_length(words, 1), 0) = 0 THEN
    RETURN 'PXX';
  END IF;
  first_word := words[1];
  IF array_length(words, 1) > 1 THEN
    last_word := words[array_length(words, 1)];
  ELSE
    last_word := COALESCE(NULLIF(substr(first_word, 2), ''), 'X');
  END IF;
  RETURN 'P' || substr(first_word, 1, 1) || substr(last_word, 1, 1);
END $$;

CREATE OR REPLACE FUNCTION next_family_code(full_name TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base TEXT := family_code_base(full_name);
  candidate TEXT := base;
  n INT := 1;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('family-code:' || base));
  WHILE EXISTS (SELECT 1 FROM "users" WHERE "familyCode" = candidate) LOOP
    n := n + 1;
    candidate := base || n;
  END LOOP;
  RETURN candidate;
END $$;

-- Existing Principals, oldest first, so the earliest family keeps the plain code.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT "id", "fullName" FROM "users"
    WHERE "isPrincipal" AND "familyCode" IS NULL
    ORDER BY COALESCE("approvedAt", "createdAt"), "createdAt", "id"
  LOOP
    UPDATE "users" SET "familyCode" = next_family_code(r."fullName") WHERE "id" = r."id";
  END LOOP;
END $$;

-- 3. Attached members, numbered in the order they joined each family.
WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "principalMemberId" ORDER BY "createdAt", "id") AS rn
  FROM "users"
  WHERE "principalMemberId" IS NOT NULL
)
UPDATE "users" u
SET "familyMemberNumber" = n.rn
FROM numbered n
WHERE u."id" = n."id" AND u."familyMemberNumber" IS NULL;

-- 4. From now on the database assigns tags, whichever code path creates or moves a member.
CREATE OR REPLACE FUNCTION assign_family_tags() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."isPrincipal" AND NEW."familyCode" IS NULL THEN
    NEW."familyCode" := next_family_code(NEW."fullName");
  END IF;

  IF NEW."principalMemberId" IS NULL THEN
    NEW."familyMemberNumber" := NULL;
  ELSIF TG_OP = 'INSERT'
     OR NEW."principalMemberId" IS DISTINCT FROM OLD."principalMemberId"
     OR NEW."familyMemberNumber" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('family-member:' || NEW."principalMemberId"));
    SELECT COALESCE(max("familyMemberNumber"), 0) + 1 INTO NEW."familyMemberNumber"
    FROM "users"
    WHERE "principalMemberId" = NEW."principalMemberId" AND "id" <> NEW."id";
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_assign_family_tags ON "users";
CREATE TRIGGER users_assign_family_tags
BEFORE INSERT OR UPDATE OF "isPrincipal", "principalMemberId", "familyMemberNumber" ON "users"
FOR EACH ROW EXECUTE FUNCTION assign_family_tags();
