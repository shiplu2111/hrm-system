ALTER TABLE "cms_changelog_entries"
  ALTER COLUMN "version_label" SET DEFAULT '',
  ALTER COLUMN "summary_en" SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS "body_html_en" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "body_json_en" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "body_html_bn" TEXT,
  ADD COLUMN IF NOT EXISTS "body_json_bn" JSONB;
