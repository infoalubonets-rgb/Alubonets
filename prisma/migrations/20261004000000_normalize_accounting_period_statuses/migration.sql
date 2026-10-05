-- Existing seeded periods defaulted to OPEN. Keep only the current calendar month open.
UPDATE "accounting_periods"
SET "status" = CASE
  WHEN "year" = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
   AND "month" = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  THEN 'OPEN'::"PeriodStatus"
  ELSE 'CLOSED'::"PeriodStatus"
END,
"closedAt" = CASE
  WHEN "year" = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
   AND "month" = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  THEN NULL
  ELSE CURRENT_TIMESTAMP
END;
