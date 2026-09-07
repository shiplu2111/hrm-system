-- Accounting / GL integration (MODULES.md §36)

CREATE TYPE "gl_account_type" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE "gl_mapping_posting_side" AS ENUM ('debit', 'credit');
CREATE TYPE "payroll_journal_export_status" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "gl_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "gl_account_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gl_payroll_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "pay_component_id" UUID,
    "system_key" TEXT,
    "posting_side" "gl_mapping_posting_side" NOT NULL,
    "gl_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_payroll_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_journal_exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "status" "payroll_journal_export_status" NOT NULL DEFAULT 'pending',
    "journal_data" JSONB NOT NULL,
    "total_debit" DECIMAL(14,2) NOT NULL,
    "total_credit" DECIMAL(14,2) NOT NULL,
    "unmapped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "exported_by_user_id" UUID,
    "exported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_journal_exports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_accounts_company_id_code_key" ON "gl_accounts"("company_id", "code");
CREATE INDEX "gl_accounts_tenant_id_idx" ON "gl_accounts"("tenant_id");
CREATE INDEX "gl_accounts_company_id_idx" ON "gl_accounts"("company_id");

CREATE UNIQUE INDEX "gl_payroll_mappings_company_id_pay_component_id_key" ON "gl_payroll_mappings"("company_id", "pay_component_id");
CREATE UNIQUE INDEX "gl_payroll_mappings_company_id_system_key_key" ON "gl_payroll_mappings"("company_id", "system_key");
CREATE INDEX "gl_payroll_mappings_tenant_id_idx" ON "gl_payroll_mappings"("tenant_id");
CREATE INDEX "gl_payroll_mappings_company_id_idx" ON "gl_payroll_mappings"("company_id");
CREATE INDEX "gl_payroll_mappings_gl_account_id_idx" ON "gl_payroll_mappings"("gl_account_id");

CREATE INDEX "payroll_journal_exports_tenant_id_idx" ON "payroll_journal_exports"("tenant_id");
CREATE INDEX "payroll_journal_exports_company_id_idx" ON "payroll_journal_exports"("company_id");
CREATE INDEX "payroll_journal_exports_payroll_period_id_idx" ON "payroll_journal_exports"("payroll_period_id");
CREATE INDEX "payroll_journal_exports_status_idx" ON "payroll_journal_exports"("status");

ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "gl_payroll_mappings" ADD CONSTRAINT "gl_payroll_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_payroll_mappings" ADD CONSTRAINT "gl_payroll_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_payroll_mappings" ADD CONSTRAINT "gl_payroll_mappings_pay_component_id_fkey" FOREIGN KEY ("pay_component_id") REFERENCES "pay_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gl_payroll_mappings" ADD CONSTRAINT "gl_payroll_mappings_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_journal_exports" ADD CONSTRAINT "payroll_journal_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_journal_exports" ADD CONSTRAINT "payroll_journal_exports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_journal_exports" ADD CONSTRAINT "payroll_journal_exports_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
