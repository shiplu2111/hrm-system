-- CreateEnum
CREATE TYPE "cms_approval_status" AS ENUM ('none', 'pending_approval', 'approved', 'rejected');

-- AlterTable: PlatformUser timezone for scheduled CMS publishing
ALTER TABLE "platform_users"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable: CmsPage approval flow & timezone-aware scheduling
ALTER TABLE "cms_pages"
  ADD COLUMN "requires_approval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approval_status" "cms_approval_status" NOT NULL DEFAULT 'none',
  ADD COLUMN "pending_approval_version_id" UUID,
  ADD COLUMN "submitted_for_approval_by_id" UUID,
  ADD COLUMN "submitted_for_approval_at" TIMESTAMPTZ(6),
  ADD COLUMN "submission_note" TEXT,
  ADD COLUMN "approved_by_id" UUID,
  ADD COLUMN "approved_at" TIMESTAMPTZ(6),
  ADD COLUMN "approval_note" TEXT,
  ADD COLUMN "rejected_by_id" UUID,
  ADD COLUMN "rejected_at" TIMESTAMPTZ(6),
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "scheduled_timezone" TEXT,
  ADD COLUMN "scheduled_by_id" UUID;

-- Flag legal pages (terms, privacy, cookies, dpa, subprocessors) for four-eyes approval
UPDATE "cms_pages"
SET "requires_approval" = true
WHERE "slug" IN ('terms', 'privacy', 'cookies', 'dpa', 'subprocessors');

-- AlterTable: CmsPost timezone-aware scheduling
ALTER TABLE "cms_posts"
  ADD COLUMN "scheduled_timezone" TEXT,
  ADD COLUMN "scheduled_by_id" UUID;

-- AlterTable: CmsChangelogEntry scheduling, publish timestamp, and soft trash
ALTER TABLE "cms_changelog_entries"
  ADD COLUMN "scheduled_at" TIMESTAMPTZ(6),
  ADD COLUMN "scheduled_timezone" TEXT,
  ADD COLUMN "scheduled_by_id" UUID,
  ADD COLUMN "published_at" TIMESTAMPTZ(6),
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "cms_pages_status_scheduled_at_idx" ON "cms_pages"("status", "scheduled_at");
CREATE INDEX "cms_pages_approval_status_idx" ON "cms_pages"("approval_status");
CREATE INDEX "cms_posts_status_scheduled_at_idx" ON "cms_posts"("status", "scheduled_at");
CREATE INDEX "cms_changelog_entries_is_published_scheduled_at_idx" ON "cms_changelog_entries"("is_published", "scheduled_at");
CREATE INDEX "cms_changelog_entries_deleted_at_idx" ON "cms_changelog_entries"("deleted_at");
