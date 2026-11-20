-- AlterEnum
ALTER TYPE "tenant_setting_category" ADD VALUE IF NOT EXISTS 'security';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "support_access_mode" AS ENUM ('read_only', 'read_write');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "support_access_status" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "platform_user_id" UUID NOT NULL,
    "staff_name" TEXT NOT NULL,
    "staff_email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "access_mode" "support_access_mode" NOT NULL DEFAULT 'read_only',
    "status" "support_access_status" NOT NULL DEFAULT 'pending',
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" UUID,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" UUID,
    "revoked_reason" TEXT,
    "token_jti" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "support_access_requests_token_jti_key" ON "support_access_requests"("token_jti");
CREATE INDEX IF NOT EXISTS "support_access_requests_tenant_id_idx" ON "support_access_requests"("tenant_id");
CREATE INDEX IF NOT EXISTS "support_access_requests_platform_user_id_idx" ON "support_access_requests"("platform_user_id");
CREATE INDEX IF NOT EXISTS "support_access_requests_status_idx" ON "support_access_requests"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "support_access_requests" ADD CONSTRAINT "support_access_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "support_access_requests" ADD CONSTRAINT "support_access_requests_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
