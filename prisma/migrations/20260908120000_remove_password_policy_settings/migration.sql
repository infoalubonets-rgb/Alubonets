-- Password strength is fixed in application validation, not configurable settings.
DELETE FROM "app_settings"
WHERE "key" IN ('password_min_length', 'password_require_mixed');