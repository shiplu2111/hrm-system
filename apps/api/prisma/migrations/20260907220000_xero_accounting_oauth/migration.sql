-- Xero OAuth accounting integration (THIRD_PARTY_INTEGRATIONS.md §§2, 3, 7)

CREATE TYPE "accounting_provider" AS ENUM ('xero', 'quickbooks', 'tally');
CREATE TYPE "accounting_connection_status" AS ENUM ('connected', 'disconnected', 'error', 'token_expired');
CREATE TYPE "accounting_sync_job_status" AS ENUM ('queued', 'processing', 'completed', 'failed');

ALTER TABLE "payroll_journal_exports"
  ADD COLUMN "provider" "accounting_provider",
  ADD COLUMN "external_reference_id" TEXT;

CREATE TABLE "accounting_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "provider" "accounting_provider" NOT NULL,
    "status" "accounting_connection_status" NOT NULL DEFAULT 'disconnected',
    "external_tenant_id" TEXT,
    "external_org_name" TEXT,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scopes" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "accounting_sync_job_status",
    "last_sync_error" TEXT,
    "connected_by_user_id" UUID,
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting_oauth_states" (
    "id" UUID NOT NULL,
    "state_token" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "accounting_provider" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting_sync_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "provider" "accounting_provider" NOT NULL DEFAULT 'xero',
    "accounting_connection_id" UUID,
    "payroll_journal_export_id" UUID,
    "status" "accounting_sync_job_status" NOT NULL DEFAULT 'queued',
    "bull_job_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "external_journal_id" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_connections_company_id_provider_key" ON "accounting_connections"("company_id", "provider");
CREATE INDEX "accounting_connections_tenant_id_idx" ON "accounting_connections"("tenant_id");
CREATE INDEX "accounting_connections_company_id_idx" ON "accounting_connections"("company_id");
CREATE INDEX "accounting_connections_status_idx" ON "accounting_connections"("status");

CREATE UNIQUE INDEX "accounting_oauth_states_state_token_key" ON "accounting_oauth_states"("state_token");
CREATE INDEX "accounting_oauth_states_expires_at_idx" ON "accounting_oauth_states"("expires_at");

CREATE INDEX "accounting_sync_jobs_tenant_id_idx" ON "accounting_sync_jobs"("tenant_id");
CREATE INDEX "accounting_sync_jobs_company_id_status_idx" ON "accounting_sync_jobs"("company_id", "status");
CREATE INDEX "accounting_sync_jobs_payroll_period_id_provider_idx" ON "accounting_sync_jobs"("payroll_period_id", "provider");

ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_sync_jobs" ADD CONSTRAINT "accounting_sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_sync_jobs" ADD CONSTRAINT "accounting_sync_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_sync_jobs" ADD CONSTRAINT "accounting_sync_jobs_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_sync_jobs" ADD CONSTRAINT "accounting_sync_jobs_accounting_connection_id_fkey" FOREIGN KEY ("accounting_connection_id") REFERENCES "accounting_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_sync_jobs" ADD CONSTRAINT "accounting_sync_jobs_payroll_journal_export_id_fkey" FOREIGN KEY ("payroll_journal_export_id") REFERENCES "payroll_journal_exports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
