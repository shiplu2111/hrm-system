-- CreateEnum
CREATE TYPE "backup_type" AS ENUM ('database', 'file_storage', 'full');

-- CreateEnum
CREATE TYPE "backup_status" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "restore_test_status" AS ENUM ('not_tested', 'pending', 'passed', 'failed');

-- CreateEnum
CREATE TYPE "restore_scope" AS ENUM ('full', 'tenant');

-- CreateEnum
CREATE TYPE "restore_request_status" AS ENUM ('pending_approval', 'approved', 'rejected', 'executing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "data_request_type" AS ENUM ('tenant_export', 'employee_anonymization', 'employee_deletion');

-- CreateEnum
CREATE TYPE "data_request_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable backup_runs
CREATE TABLE IF NOT EXISTS "backup_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "backup_type" "backup_type" NOT NULL DEFAULT 'full',
    "storage_driver" TEXT NOT NULL DEFAULT 'local_disk',
    "status" "backup_status" NOT NULL DEFAULT 'pending',
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL,
    "checksum" TEXT,
    "includes_file_storage" BOOLEAN NOT NULL DEFAULT false,
    "retention_expiry" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "restore_test_status" "restore_test_status" NOT NULL DEFAULT 'not_tested',
    "restore_test_at" TIMESTAMPTZ(6),
    "restore_test_duration_ms" INTEGER,
    "restore_test_details" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable restore_requests
CREATE TABLE IF NOT EXISTS "restore_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "backup_run_id" UUID NOT NULL,
    "scope" "restore_scope" NOT NULL DEFAULT 'tenant',
    "tenant_id" UUID,
    "status" "restore_request_status" NOT NULL DEFAULT 'pending_approval',
    "requested_by_user_id" UUID NOT NULL,
    "requested_by_name" TEXT,
    "reason" TEXT NOT NULL,
    "approved_by_user_id" UUID,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_by_user_id" UUID,
    "rejected_by_name" TEXT,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "job_id" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "logs" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable data_requests
CREATE TABLE IF NOT EXISTS "data_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "data_request_type" NOT NULL,
    "status" "data_request_status" NOT NULL DEFAULT 'pending',
    "target_employee_id" UUID,
    "requested_by_user_id" UUID NOT NULL,
    "requested_by_name" TEXT,
    "reason" TEXT NOT NULL,
    "archive_url" TEXT,
    "archive_size_bytes" BIGINT,
    "archive_expires_at" TIMESTAMPTZ(6),
    "anonymized_summary" JSONB,
    "job_id" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "logs" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes for backup_runs
CREATE INDEX IF NOT EXISTS "backup_runs_status_idx" ON "backup_runs"("status");
CREATE INDEX IF NOT EXISTS "backup_runs_started_at_idx" ON "backup_runs"("started_at");

-- Indexes for restore_requests
CREATE INDEX IF NOT EXISTS "restore_requests_tenant_id_idx" ON "restore_requests"("tenant_id");
CREATE INDEX IF NOT EXISTS "restore_requests_backup_run_id_idx" ON "restore_requests"("backup_run_id");
CREATE INDEX IF NOT EXISTS "restore_requests_status_idx" ON "restore_requests"("status");

-- Indexes for data_requests
CREATE INDEX IF NOT EXISTS "data_requests_tenant_id_idx" ON "data_requests"("tenant_id");
CREATE INDEX IF NOT EXISTS "data_requests_target_employee_id_idx" ON "data_requests"("target_employee_id");
CREATE INDEX IF NOT EXISTS "data_requests_status_idx" ON "data_requests"("status");
CREATE INDEX IF NOT EXISTS "data_requests_type_idx" ON "data_requests"("type");

-- Foreign Keys
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_backup_run_id_fkey" FOREIGN KEY ("backup_run_id") REFERENCES "backup_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_target_employee_id_fkey" FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
