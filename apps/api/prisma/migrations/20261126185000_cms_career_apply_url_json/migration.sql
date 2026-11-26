ALTER TABLE "cms_careers"
  ALTER COLUMN "department" SET DEFAULT 'General',
  ALTER COLUMN "summary_en" SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS "description_json_en" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "description_json_bn" JSONB,
  ADD COLUMN IF NOT EXISTS "apply_url" TEXT;
