-- Employment Contracts (MODULES.md §06)

CREATE TYPE "employment_contract_type" AS ENUM (
  'permanent',
  'fixed_term',
  'casual',
  'project_based'
);

CREATE TYPE "employment_contract_status" AS ENUM ('draft', 'active', 'terminated');

CREATE TYPE "pay_frequency" AS ENUM ('hourly', 'weekly', 'biweekly', 'monthly', 'annual');

CREATE TABLE "employment_contracts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "contract_type" "employment_contract_type" NOT NULL,
  "status" "employment_contract_status" NOT NULL DEFAULT 'draft',
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "probation_end_date" DATE,
  "working_hours_per_week" DECIMAL(5, 2),
  "pay_rate" DECIMAL(14, 2),
  "pay_frequency" "pay_frequency",
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "leave_entitlement_days" DECIMAL(8, 2),
  "overtime_rule" JSONB,
  "notice_period_days" INTEGER,
  "employer_notice_days" INTEGER,
  "termination_conditions" TEXT,
  "renewed_from_id" UUID,
  "signed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employment_contract_documents" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "file_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employment_contract_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employment_contracts_tenant_id_idx" ON "employment_contracts"("tenant_id");
CREATE INDEX "employment_contracts_company_id_idx" ON "employment_contracts"("company_id");
CREATE INDEX "employment_contracts_employee_id_idx" ON "employment_contracts"("employee_id");
CREATE INDEX "employment_contracts_status_idx" ON "employment_contracts"("status");
CREATE INDEX "employment_contracts_end_date_idx" ON "employment_contracts"("end_date");

CREATE INDEX "employment_contract_documents_contract_id_idx" ON "employment_contract_documents"("contract_id");
CREATE INDEX "employment_contract_documents_tenant_id_idx" ON "employment_contract_documents"("tenant_id");

ALTER TABLE "employment_contracts"
  ADD CONSTRAINT "employment_contracts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employment_contracts"
  ADD CONSTRAINT "employment_contracts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employment_contracts"
  ADD CONSTRAINT "employment_contracts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employment_contracts"
  ADD CONSTRAINT "employment_contracts_renewed_from_id_fkey"
  FOREIGN KEY ("renewed_from_id") REFERENCES "employment_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employment_contract_documents"
  ADD CONSTRAINT "employment_contract_documents_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "employment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employment_contract_documents"
  ADD CONSTRAINT "employment_contract_documents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
