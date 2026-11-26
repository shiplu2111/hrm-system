-- AlterTable
ALTER TABLE "global_kb_articles"
  ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "helpful_yes_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "helpful_no_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "global_kb_articles_status_published_is_public_idx"
  ON "global_kb_articles" ("status", "published", "is_public");
