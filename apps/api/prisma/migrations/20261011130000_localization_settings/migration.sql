-- Localization overrides per company and branch (null inherits), and per-user UI language.
ALTER TABLE "companies"
  ADD COLUMN "default_language" VARCHAR(8),
  ADD COLUMN "date_format" VARCHAR(20),
  ADD COLUMN "number_format" VARCHAR(20);

ALTER TABLE "locations"
  ADD COLUMN "default_language" VARCHAR(8),
  ADD COLUMN "date_format" VARCHAR(20),
  ADD COLUMN "number_format" VARCHAR(20);

ALTER TABLE "users"
  ADD COLUMN "preferred_language" VARCHAR(8);
