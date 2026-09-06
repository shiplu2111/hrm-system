-- Expense & Reimbursement (MODULES.md §23)

CREATE TYPE "expense_claim_status" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'cancelled',
  'reimbursed'
);

CREATE TABLE "expense_categories" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "max_amount_per_claim" DECIMAL(14, 2),
  "max_amount_per_month" DECIMAL(14, 2),
  "receipt_required" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_claims" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "reference_number" TEXT NOT NULL,
  "expense_date" DATE NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
  "description" TEXT,
  "status" "expense_claim_status" NOT NULL DEFAULT 'draft',
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "reimbursed_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_claim_receipts" (
  "id" UUID NOT NULL,
  "claim_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "file_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expense_claim_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expense_categories_company_id_name_key"
  ON "expense_categories"("company_id", "name");

CREATE INDEX "expense_categories_tenant_id_idx" ON "expense_categories"("tenant_id");
CREATE INDEX "expense_categories_company_id_idx" ON "expense_categories"("company_id");

CREATE UNIQUE INDEX "expense_claims_company_id_reference_number_key"
  ON "expense_claims"("company_id", "reference_number");

CREATE INDEX "expense_claims_tenant_id_idx" ON "expense_claims"("tenant_id");
CREATE INDEX "expense_claims_company_id_idx" ON "expense_claims"("company_id");
CREATE INDEX "expense_claims_employee_id_idx" ON "expense_claims"("employee_id");
CREATE INDEX "expense_claims_category_id_idx" ON "expense_claims"("category_id");
CREATE INDEX "expense_claims_status_idx" ON "expense_claims"("status");
CREATE INDEX "expense_claims_expense_date_idx" ON "expense_claims"("expense_date");

CREATE INDEX "expense_claim_receipts_claim_id_idx" ON "expense_claim_receipts"("claim_id");
CREATE INDEX "expense_claim_receipts_tenant_id_idx" ON "expense_claim_receipts"("tenant_id");

ALTER TABLE "expense_categories"
  ADD CONSTRAINT "expense_categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_categories"
  ADD CONSTRAINT "expense_categories_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_claims"
  ADD CONSTRAINT "expense_claims_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_claims"
  ADD CONSTRAINT "expense_claims_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_claims"
  ADD CONSTRAINT "expense_claims_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_claims"
  ADD CONSTRAINT "expense_claims_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_claim_receipts"
  ADD CONSTRAINT "expense_claim_receipts_claim_id_fkey"
  FOREIGN KEY ("claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expense_claim_receipts"
  ADD CONSTRAINT "expense_claim_receipts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
