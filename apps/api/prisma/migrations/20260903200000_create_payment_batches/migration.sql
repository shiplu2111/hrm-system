-- Payment batches for salary disbursement (MODULES.md §19)

CREATE TYPE "payment_batch_status" AS ENUM ('draft', 'pending', 'paid', 'failed');
CREATE TYPE "payment_batch_item_status" AS ENUM ('pending', 'paid', 'failed');

CREATE TABLE "payment_batches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "status" "payment_batch_status" NOT NULL DEFAULT 'draft',
    "total_amount" DECIMAL(14,2) NOT NULL,
    "item_count" INTEGER NOT NULL,
    "transaction_reference" TEXT,
    "failure_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_batch_items" (
    "id" UUID NOT NULL,
    "payment_batch_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "payment_batch_item_status" NOT NULL DEFAULT 'pending',
    "transaction_reference" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_batches_company_id_reference_number_key" ON "payment_batches"("company_id", "reference_number");
CREATE INDEX "payment_batches_company_id_idx" ON "payment_batches"("company_id");
CREATE INDEX "payment_batches_payroll_period_id_idx" ON "payment_batches"("payroll_period_id");
CREATE INDEX "payment_batches_status_idx" ON "payment_batches"("status");

CREATE UNIQUE INDEX "payment_batch_items_payroll_run_id_key" ON "payment_batch_items"("payroll_run_id");
CREATE INDEX "payment_batch_items_payment_batch_id_idx" ON "payment_batch_items"("payment_batch_id");
CREATE INDEX "payment_batch_items_employee_id_idx" ON "payment_batch_items"("employee_id");
CREATE INDEX "payment_batch_items_status_idx" ON "payment_batch_items"("status");

ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "payslips_payroll_run_id_key" ON "payslips"("payroll_run_id");
