-- AlterEnum
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'trial';
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'pending_deletion';
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'deleted';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tenant_suspension_mode" AS ENUM ('read_only', 'fully_blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable tenants
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "suspension_mode" "tenant_suspension_mode",
  ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduled_deletion_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable platform_audit_logs
ALTER TABLE "platform_audit_logs"
  ADD COLUMN IF NOT EXISTS "reason" TEXT;
