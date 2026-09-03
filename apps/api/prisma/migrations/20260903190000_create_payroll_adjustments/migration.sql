-- Retroactive payroll adjustments (PAYROLL_LOGIC.md §11)

CREATE TYPE "payroll_adjustment_status" AS ENUM ('draft', 'pending', 'applied', 'cancelled');

CREATE TABLE "payroll_adjustments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "original_payroll_run_id" UUID NOT NULL,
    "apply_to_payroll_period_id" UUID,
    "retroactive_from" DATE NOT NULL,
    "retroactive_to" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "original_gross_pay" DECIMAL(14,2) NOT NULL,
    "original_total_deductions" DECIMAL(14,2) NOT NULL,
    "original_net_pay" DECIMAL(14,2) NOT NULL,
    "revised_gross_pay" DECIMAL(14,2) NOT NULL,
    "revised_total_deductions" DECIMAL(14,2) NOT NULL,
    "revised_net_pay" DECIMAL(14,2) NOT NULL,
    "adjustment_gross_pay" DECIMAL(14,2) NOT NULL,
    "adjustment_total_deductions" DECIMAL(14,2) NOT NULL,
    "adjustment_net_pay" DECIMAL(14,2) NOT NULL,
    "status" "payroll_adjustment_status" NOT NULL DEFAULT 'draft',
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_adjustments_company_id_idx" ON "payroll_adjustments"("company_id");
CREATE INDEX "payroll_adjustments_employee_id_idx" ON "payroll_adjustments"("employee_id");
CREATE INDEX "payroll_adjustments_original_payroll_run_id_idx" ON "payroll_adjustments"("original_payroll_run_id");
CREATE INDEX "payroll_adjustments_apply_to_payroll_period_id_idx" ON "payroll_adjustments"("apply_to_payroll_period_id");
CREATE INDEX "payroll_adjustments_status_idx" ON "payroll_adjustments"("status");

ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_original_payroll_run_id_fkey" FOREIGN KEY ("original_payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_apply_to_payroll_period_id_fkey" FOREIGN KEY ("apply_to_payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
