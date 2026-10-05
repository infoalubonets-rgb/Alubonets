-- Additive: lets a purpose be typed "Other" (treated like one-off for standing).
ALTER TYPE "BillingKind" ADD VALUE IF NOT EXISTS 'OTHER';
