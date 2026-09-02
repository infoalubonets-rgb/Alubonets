UPDATE "resolutions"
SET
  "documentUrl" = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  "documentName" = 'Welfare-Budget-Proposal-2026.pdf',
  "allowAnonymous" = true
WHERE "id" = 'gov-sample-welfare-budget';

INSERT INTO "resolutions" (
  "id",
  "title",
  "body",
  "category",
  "status",
  "documentUrl",
  "documentName",
  "visibleToRoles",
  "allowAnonymous",
  "createdById",
  "decidedById",
  "decidedAt",
  "resultsPublished",
  "createdAt",
  "updatedAt"
)
SELECT
  'gov-sample-events-policy',
  'Adopt 2026 events and fundraising policy',
  'Members are asked to approve the attached events and fundraising policy for 2026. It sets how project income is recorded, how fundraising drives are announced, and the approval steps for new community events.',
  'POLICY',
  'APPROVED',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'Events-Fundraising-Policy-2026.pdf',
  ARRAY['MEMBER','ADMIN','EXECUTIVE','TREASURER','SECRETARY','ORGANIZER']::"Role"[],
  true,
  u."id",
  u."id",
  CURRENT_TIMESTAMP,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."email" = 'superadmin@alubonets.com'
ON CONFLICT ("id") DO NOTHING;
