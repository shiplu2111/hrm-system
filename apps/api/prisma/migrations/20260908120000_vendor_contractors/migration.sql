-- MODULES.md §31 Vendor / Contractor Management — invoice-based, not salary_structures

CREATE TYPE "contractor_kind" AS ENUM ('freelancer', 'consultant', 'vendor');
CREATE TYPE "contractor_status" AS ENUM ('draft', 'active', 'inactive');
CREATE TYPE "contractor_contract_status" AS ENUM ('draft', 'active', 'expired', 'terminated');
CREATE TYPE "contractor_payment_terms" AS ENUM ('due_on_receipt', 'net_7', 'net_14', 'net_30', 'net_45', 'net_60');
CREATE TYPE "contractor_billing_frequency" AS ENUM ('per_invoice', 'weekly', 'monthly', 'milestone');
CREATE TYPE "contractor_invoice_status" AS ENUM ('draft', 'submitted', 'approved', 'scheduled', 'paid', 'rejected', 'cancelled');
CREATE TYPE "contractor_payment_batch_status" AS ENUM ('draft', 'pending', 'paid', 'failed');
CREATE TYPE "contractor_payment_batch_item_status" AS ENUM ('pending', 'paid', 'failed');

CREATE TABLE "contractors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contractor_number" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT,
    "contractor_kind" "contractor_kind" NOT NULL DEFAULT 'consultant',
    "category" TEXT,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "tax_id" TEXT,
    "status" "contractor_status" NOT NULL DEFAULT 'draft',
    "owner_employee_id" UUID,
    "bank_details" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contractor_contracts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contractor_id" UUID NOT NULL,
    "contract_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope_description" TEXT,
    "status" "contractor_contract_status" NOT NULL DEFAULT 'draft',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "annual_value" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "payment_terms" "contractor_payment_terms" NOT NULL DEFAULT 'net_30',
    "billing_frequency" "contractor_billing_frequency" NOT NULL DEFAULT 'monthly',
    "auto_renewal" BOOLEAN NOT NULL DEFAULT false,
    "notice_period_days" INTEGER NOT NULL DEFAULT 30,
    "owner_employee_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contractor_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contractor_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "period_label" TEXT,
    "description" TEXT,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "contractor_invoice_status" NOT NULL DEFAULT 'draft',
    "paid_at" TIMESTAMP(3),
    "payment_reference" TEXT,
    "approved_by_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contractor_payment_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "status" "contractor_payment_batch_status" NOT NULL DEFAULT 'draft',
    "total_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "item_count" INTEGER NOT NULL,
    "transaction_reference" TEXT,
    "failure_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_payment_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contractor_payment_batch_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_batch_id" UUID NOT NULL,
    "contractor_invoice_id" UUID NOT NULL,
    "contractor_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "contractor_payment_batch_item_status" NOT NULL DEFAULT 'pending',
    "transaction_reference" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_payment_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contractors_company_id_contractor_number_key" ON "contractors"("company_id", "contractor_number");
CREATE INDEX "contractors_tenant_id_idx" ON "contractors"("tenant_id");
CREATE INDEX "contractors_company_id_status_idx" ON "contractors"("company_id", "status");

CREATE UNIQUE INDEX "contractor_contracts_company_id_contract_number_key" ON "contractor_contracts"("company_id", "contract_number");
CREATE INDEX "contractor_contracts_tenant_id_idx" ON "contractor_contracts"("tenant_id");
CREATE INDEX "contractor_contracts_company_id_status_idx" ON "contractor_contracts"("company_id", "status");
CREATE INDEX "contractor_contracts_contractor_id_idx" ON "contractor_contracts"("contractor_id");
CREATE INDEX "contractor_contracts_company_id_end_date_idx" ON "contractor_contracts"("company_id", "end_date");

CREATE UNIQUE INDEX "contractor_invoices_company_id_invoice_number_key" ON "contractor_invoices"("company_id", "invoice_number");
CREATE INDEX "contractor_invoices_tenant_id_idx" ON "contractor_invoices"("tenant_id");
CREATE INDEX "contractor_invoices_company_id_status_idx" ON "contractor_invoices"("company_id", "status");
CREATE INDEX "contractor_invoices_contractor_id_idx" ON "contractor_invoices"("contractor_id");
CREATE INDEX "contractor_invoices_contract_id_idx" ON "contractor_invoices"("contract_id");
CREATE INDEX "contractor_invoices_company_id_due_at_idx" ON "contractor_invoices"("company_id", "due_at");

CREATE UNIQUE INDEX "contractor_payment_batches_company_id_reference_number_key" ON "contractor_payment_batches"("company_id", "reference_number");
CREATE INDEX "contractor_payment_batches_tenant_id_idx" ON "contractor_payment_batches"("tenant_id");
CREATE INDEX "contractor_payment_batches_company_id_status_idx" ON "contractor_payment_batches"("company_id", "status");

CREATE UNIQUE INDEX "contractor_payment_batch_items_contractor_invoice_id_key" ON "contractor_payment_batch_items"("contractor_invoice_id");
CREATE INDEX "contractor_payment_batch_items_tenant_id_idx" ON "contractor_payment_batch_items"("tenant_id");
CREATE INDEX "contractor_payment_batch_items_payment_batch_id_idx" ON "contractor_payment_batch_items"("payment_batch_id");
CREATE INDEX "contractor_payment_batch_items_contractor_id_idx" ON "contractor_payment_batch_items"("contractor_id");
CREATE INDEX "contractor_payment_batch_items_status_idx" ON "contractor_payment_batch_items"("status");

ALTER TABLE "contractors" ADD CONSTRAINT "contractors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contractor_contracts" ADD CONSTRAINT "contractor_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_contracts" ADD CONSTRAINT "contractor_contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_contracts" ADD CONSTRAINT "contractor_contracts_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_contracts" ADD CONSTRAINT "contractor_contracts_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contractor_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contractor_payment_batches" ADD CONSTRAINT "contractor_payment_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_payment_batches" ADD CONSTRAINT "contractor_payment_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contractor_payment_batch_items" ADD CONSTRAINT "contractor_payment_batch_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_payment_batch_items" ADD CONSTRAINT "contractor_payment_batch_items_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "contractor_payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_payment_batch_items" ADD CONSTRAINT "contractor_payment_batch_items_contractor_invoice_id_fkey" FOREIGN KEY ("contractor_invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contractor_payment_batch_items" ADD CONSTRAINT "contractor_payment_batch_items_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
