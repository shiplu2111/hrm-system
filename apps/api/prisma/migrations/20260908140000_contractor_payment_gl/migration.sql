-- MODULES.md §31 — contract payment structures + contractor GL export (separate from payroll journals)

CREATE TYPE "contractor_payment_structure" AS ENUM ('fixed_project_fee', 'milestone', 'hourly_invoice');
CREATE TYPE "contractor_milestone_status" AS ENUM ('pending', 'invoiced', 'paid');

ALTER TABLE "contractor_contracts"
  ADD COLUMN "fixed_fee_amount" DECIMAL(14,2),
  ADD COLUMN "hourly_rate" DECIMAL(14,2),
  ADD COLUMN "payment_structure" "contractor_payment_structure" NOT NULL DEFAULT 'fixed_project_fee';

CREATE TABLE "contractor_contract_milestones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "target_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "contractor_milestone_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_contract_milestones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contractor_invoices"
  ADD COLUMN "milestone_id" UUID,
  ADD COLUMN "hours_worked" DECIMAL(10,2),
  ADD COLUMN "hourly_rate" DECIMAL(14,2);

CREATE TABLE "gl_contractor_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "system_key" TEXT NOT NULL,
    "posting_side" "gl_mapping_posting_side" NOT NULL,
    "gl_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gl_contractor_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contractor_journal_exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contractor_payment_batch_id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "status" "payroll_journal_export_status" NOT NULL DEFAULT 'pending',
    "provider" "accounting_provider",
    "journal_data" JSONB NOT NULL,
    "total_debit" DECIMAL(14,2) NOT NULL,
    "total_credit" DECIMAL(14,2) NOT NULL,
    "unmapped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "external_reference_id" TEXT,
    "exported_by_user_id" UUID,
    "exported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_journal_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contractor_contract_milestones_contract_id_idx" ON "contractor_contract_milestones"("contract_id");

CREATE INDEX "contractor_invoices_milestone_id_idx" ON "contractor_invoices"("milestone_id");

CREATE UNIQUE INDEX "gl_contractor_mappings_company_id_system_key_key"
  ON "gl_contractor_mappings"("company_id", "system_key");
CREATE INDEX "gl_contractor_mappings_tenant_id_idx" ON "gl_contractor_mappings"("tenant_id");
CREATE INDEX "gl_contractor_mappings_company_id_idx" ON "gl_contractor_mappings"("company_id");
CREATE INDEX "gl_contractor_mappings_gl_account_id_idx" ON "gl_contractor_mappings"("gl_account_id");

CREATE UNIQUE INDEX "contractor_journal_exports_contractor_payment_batch_id_key"
  ON "contractor_journal_exports"("contractor_payment_batch_id");
CREATE INDEX "contractor_journal_exports_tenant_id_idx" ON "contractor_journal_exports"("tenant_id");
CREATE INDEX "contractor_journal_exports_company_id_idx" ON "contractor_journal_exports"("company_id");

ALTER TABLE "contractor_contract_milestones"
  ADD CONSTRAINT "contractor_contract_milestones_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_contract_milestones"
  ADD CONSTRAINT "contractor_contract_milestones_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_contract_milestones"
  ADD CONSTRAINT "contractor_contract_milestones_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contractor_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contractor_invoices"
  ADD CONSTRAINT "contractor_invoices_milestone_id_fkey"
  FOREIGN KEY ("milestone_id") REFERENCES "contractor_contract_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gl_contractor_mappings"
  ADD CONSTRAINT "gl_contractor_mappings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_contractor_mappings"
  ADD CONSTRAINT "gl_contractor_mappings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_contractor_mappings"
  ADD CONSTRAINT "gl_contractor_mappings_gl_account_id_fkey"
  FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contractor_journal_exports"
  ADD CONSTRAINT "contractor_journal_exports_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_journal_exports"
  ADD CONSTRAINT "contractor_journal_exports_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_journal_exports"
  ADD CONSTRAINT "contractor_journal_exports_contractor_payment_batch_id_fkey"
  FOREIGN KEY ("contractor_payment_batch_id") REFERENCES "contractor_payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
