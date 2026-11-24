-- AlterEnum
ALTER TYPE "data_request_status" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "data_request_status" ADD VALUE IF NOT EXISTS 'rejected';

-- AlterTable
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMPTZ(6);
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "approved_by_user_id" UUID;
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "approved_by_name" TEXT;
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6);
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "rejected_by_user_id" UUID;
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "rejected_by_name" TEXT;
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6);
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "legal_retention_exceptions" JSONB;
ALTER TABLE "data_requests" ADD COLUMN IF NOT EXISTS "completion_record" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "data_requests_deadline_idx" ON "data_requests"("deadline");
