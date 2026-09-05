-- Employee Loans & Salary Advances (MODULES.md §22)

CREATE TYPE "employee_loan_kind" AS ENUM ('loan', 'salary_advance');

CREATE TYPE "employee_loan_status" AS ENUM (
  'pending_approval',
  'active',
  'fully_paid',
  'rejected',
  'cancelled'
);

CREATE TYPE "loan_installment_status" AS ENUM ('scheduled', 'paid', 'skipped');

CREATE TABLE "employee_loans" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "reference_number" TEXT NOT NULL,
  "loan_kind" "employee_loan_kind" NOT NULL,
  "purpose_label" TEXT,
  "principal_amount" DECIMAL(14, 2) NOT NULL,
  "interest_rate_percent" DECIMAL(8, 4) NOT NULL DEFAULT 0,
  "tenor_months" INTEGER NOT NULL,
  "monthly_installment" DECIMAL(14, 2) NOT NULL,
  "total_repayable" DECIMAL(14, 2) NOT NULL,
  "repaid_amount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "remaining_balance" DECIMAL(14, 2) NOT NULL,
  "installments_paid" INTEGER NOT NULL DEFAULT 0,
  "deduct_from_payroll" BOOLEAN NOT NULL DEFAULT true,
  "status" "employee_loan_status" NOT NULL DEFAULT 'pending_approval',
  "first_due_date" DATE,
  "disbursed_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "pay_component_id" UUID,
  "salary_structure_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loan_installments" (
  "id" UUID NOT NULL,
  "loan_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "installment_number" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "principal_portion" DECIMAL(14, 2) NOT NULL,
  "interest_portion" DECIMAL(14, 2) NOT NULL,
  "total_due" DECIMAL(14, 2) NOT NULL,
  "status" "loan_installment_status" NOT NULL DEFAULT 'scheduled',
  "paid_at" TIMESTAMP(3),
  "payroll_run_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "loan_installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_loans_company_id_reference_number_key"
  ON "employee_loans"("company_id", "reference_number");

CREATE INDEX "employee_loans_tenant_id_idx" ON "employee_loans"("tenant_id");
CREATE INDEX "employee_loans_company_id_idx" ON "employee_loans"("company_id");
CREATE INDEX "employee_loans_employee_id_idx" ON "employee_loans"("employee_id");
CREATE INDEX "employee_loans_status_idx" ON "employee_loans"("status");

CREATE UNIQUE INDEX "loan_installments_loan_id_installment_number_key"
  ON "loan_installments"("loan_id", "installment_number");

CREATE INDEX "loan_installments_loan_id_idx" ON "loan_installments"("loan_id");
CREATE INDEX "loan_installments_tenant_id_idx" ON "loan_installments"("tenant_id");
CREATE INDEX "loan_installments_due_date_status_idx" ON "loan_installments"("due_date", "status");
CREATE INDEX "loan_installments_payroll_run_id_idx" ON "loan_installments"("payroll_run_id");

ALTER TABLE "employee_loans"
  ADD CONSTRAINT "employee_loans_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_loans"
  ADD CONSTRAINT "employee_loans_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_loans"
  ADD CONSTRAINT "employee_loans_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_loans"
  ADD CONSTRAINT "employee_loans_pay_component_id_fkey"
  FOREIGN KEY ("pay_component_id") REFERENCES "pay_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_loans"
  ADD CONSTRAINT "employee_loans_salary_structure_id_fkey"
  FOREIGN KEY ("salary_structure_id") REFERENCES "salary_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_installments"
  ADD CONSTRAINT "loan_installments_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "employee_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loan_installments"
  ADD CONSTRAINT "loan_installments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loan_installments"
  ADD CONSTRAINT "loan_installments_payroll_run_id_fkey"
  FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
