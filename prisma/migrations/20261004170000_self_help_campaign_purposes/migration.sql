-- Standard self-help group campaign purposes (Other is the existing system category).
-- Additive: inserts any that are missing by name and reactivates archived ones.
INSERT INTO "transaction_categories" ("id", "code", "name", "type", "active", "createdAt", "updatedAt")
SELECT v.id, v.code, v.name, 'INCOME', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('cat-bereavement-support', 'BEREAVEMENT_SUPPORT', 'Bereavement Support'),
  ('cat-medical-emergency', 'MEDICAL_EMERGENCY', 'Medical Emergency'),
  ('cat-wedding-support', 'WEDDING_SUPPORT', 'Wedding Support'),
  ('cat-education-support', 'EDUCATION_SUPPORT', 'Education Support'),
  ('cat-group-investment', 'GROUP_INVESTMENT', 'Group Investment')
) AS v(id, code, name)
WHERE NOT EXISTS (SELECT 1 FROM "transaction_categories" c WHERE lower(c."name") = lower(v.name))
ON CONFLICT ("code") DO NOTHING;

UPDATE "transaction_categories"
SET "active" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE lower("name") IN ('bereavement support', 'medical emergency', 'wedding support', 'education support', 'group investment')
  AND "active" = false;
