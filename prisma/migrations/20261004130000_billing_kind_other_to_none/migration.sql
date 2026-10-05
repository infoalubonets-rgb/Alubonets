-- "Other" is now the label for NONE; move any categories saved as OTHER back to NONE.
UPDATE "transaction_categories" SET "billingKind" = 'NONE' WHERE "billingKind" = 'OTHER';
