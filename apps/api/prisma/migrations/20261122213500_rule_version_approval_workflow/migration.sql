-- AlterEnum rule_version_status
ALTER TYPE "rule_version_status" ADD VALUE IF NOT EXISTS 'rejected';

-- AlterTable country_rules
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "submitted_by" TEXT;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "submission_note" TEXT;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "approved_by" TEXT;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "rejected_by" TEXT;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3);
