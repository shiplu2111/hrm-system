ALTER TABLE "cms_faqs"
  ADD COLUMN IF NOT EXISTS "answer_json_en" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "answer_json_bn" JSONB;
