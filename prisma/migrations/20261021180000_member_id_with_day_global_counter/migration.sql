-- Member IDs become AL + YYMMDD of approval + a system-wide member number (AL261003-006 = the 6th
-- member, approved on 3 October 2026). Existing IDs are renumbered in approval order; an old ID is
-- kept in "legacyMembershipNumber" when that is still empty, so it can be traced.

UPDATE "users"
SET "legacyMembershipNumber" = "membershipNumber"
WHERE "membershipNumber" IS NOT NULL AND "legacyMembershipNumber" IS NULL;

WITH numbered AS (
  SELECT "id",
    (COALESCE("approvedAt", "createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi' AS local_at,
    row_number() OVER (ORDER BY COALESCE("approvedAt", "createdAt"), "createdAt", "id") AS rn
  FROM "users"
  WHERE "membershipNumber" IS NOT NULL
)
UPDATE "users" u
SET "membershipNumber" = 'AL' || to_char(n.local_at, 'YYMMDD') || '-' || lpad(n.rn::text, 3, '0')
FROM numbered n
WHERE u."id" = n."id";

-- One counter for everyone (key 0), continuing from the highest number now in use.
INSERT INTO "membership_sequences" ("year", "lastValue", "updatedAt")
SELECT 0, COALESCE(max(substr("membershipNumber", 10)::int), 0), now()
FROM "users"
WHERE "membershipNumber" ~ '^AL[0-9]{6}-[0-9]{3,}$'
ON CONFLICT ("year") DO UPDATE
SET "lastValue" = GREATEST("membership_sequences"."lastValue", EXCLUDED."lastValue"), "updatedAt" = now();
