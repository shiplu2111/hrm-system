-- CreateEnum
CREATE TYPE "leave_accrual_type" AS ENUM ('monthly', 'yearly', 'on_hire');

-- CreateEnum
CREATE TYPE "leave_request_status" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "pay_component_type" AS ENUM ('earning', 'deduction');

-- CreateEnum
CREATE TYPE "pay_component_calculation_type" AS ENUM ('fixed', 'formula', 'percentage');

-- CreateEnum
CREATE TYPE "salary_structure_component_type" AS ENUM ('earning', 'deduction');

-- CreateEnum
CREATE TYPE "payroll_period_status" AS ENUM ('draft', 'open', 'processing', 'closed');

-- CreateEnum
CREATE TYPE "payroll_run_status" AS ENUM ('draft', 'calculated', 'under_review', 'approved', 'finalized', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "pay_components" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "pay_component_type" NOT NULL,
    "calculation_type" "pay_component_calculation_type" NOT NULL,
    "formula" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_rules" (
    "id" UUID NOT NULL,
    "country_id" UUID,
    "company_id" UUID,
    "rule_json" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_minutes" INTEGER NOT NULL DEFAULT 0,
    "ot_rule_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rosters" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "location_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "entitlement_days" DECIMAL(8,2) NOT NULL,
    "accrual_type" "leave_accrual_type" NOT NULL,
    "carry_forward_max" DECIMAL(8,2),
    "expiry_months" INTEGER,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "balance_days" DECIMAL(8,2) NOT NULL,
    "as_of_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "leave_request_status" NOT NULL DEFAULT 'draft',
    "approval_chain" JSONB NOT NULL DEFAULT '[]',
    "local_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "component_type" "salary_structure_component_type" NOT NULL,
    "component_id" UUID NOT NULL,
    "amount_or_formula" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "status" "payroll_period_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "gross_pay" DECIMAL(14,2) NOT NULL,
    "total_deductions" DECIMAL(14,2) NOT NULL,
    "net_pay" DECIMAL(14,2) NOT NULL,
    "status" "payroll_run_status" NOT NULL DEFAULT 'draft',
    "finalized_at" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "bracket_json" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_tax_profiles" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "tax_id_number" TEXT,
    "tax_settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "superannuation_contributions" (
    "id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_contribution" DECIMAL(14,2) NOT NULL,
    "employer_contribution" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "superannuation_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pay_components_company_id_idx" ON "pay_components"("company_id");

-- CreateIndex
CREATE INDEX "payroll_rules_country_id_idx" ON "payroll_rules"("country_id");

-- CreateIndex
CREATE INDEX "payroll_rules_company_id_idx" ON "payroll_rules"("company_id");

-- CreateIndex
CREATE INDEX "payroll_rules_country_id_effective_from_idx" ON "payroll_rules"("country_id", "effective_from");

-- CreateIndex
CREATE INDEX "payroll_rules_company_id_effective_from_idx" ON "payroll_rules"("company_id", "effective_from");

-- CreateIndex
CREATE INDEX "shifts_company_id_idx" ON "shifts"("company_id");

-- CreateIndex
CREATE INDEX "shifts_ot_rule_id_idx" ON "shifts"("ot_rule_id");

-- CreateIndex
CREATE INDEX "rosters_shift_id_idx" ON "rosters"("shift_id");

-- CreateIndex
CREATE INDEX "rosters_location_id_idx" ON "rosters"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "rosters_employee_id_date_key" ON "rosters"("employee_id", "date");

-- CreateIndex
CREATE INDEX "leave_types_company_id_idx" ON "leave_types"("company_id");

-- CreateIndex
CREATE INDEX "leave_policies_company_id_idx" ON "leave_policies"("company_id");

-- CreateIndex
CREATE INDEX "leave_policies_leave_type_id_idx" ON "leave_policies"("leave_type_id");

-- CreateIndex
CREATE INDEX "leave_policies_company_id_leave_type_id_effective_from_idx" ON "leave_policies"("company_id", "leave_type_id", "effective_from");

-- CreateIndex
CREATE INDEX "leave_balances_leave_type_id_idx" ON "leave_balances"("leave_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_as_of_year_key" ON "leave_balances"("employee_id", "leave_type_id", "as_of_year");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_leave_type_id_idx" ON "leave_requests"("leave_type_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_employee_id_local_id_key" ON "leave_requests"("employee_id", "local_id");

-- CreateIndex
CREATE INDEX "salary_structures_employee_id_idx" ON "salary_structures"("employee_id");

-- CreateIndex
CREATE INDEX "salary_structures_component_id_idx" ON "salary_structures"("component_id");

-- CreateIndex
CREATE INDEX "salary_structures_employee_id_effective_from_idx" ON "salary_structures"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "payroll_periods_company_id_idx" ON "payroll_periods"("company_id");

-- CreateIndex
CREATE INDEX "payroll_periods_company_id_start_date_idx" ON "payroll_periods"("company_id", "start_date");

-- CreateIndex
CREATE INDEX "payroll_runs_payroll_period_id_idx" ON "payroll_runs"("payroll_period_id");

-- CreateIndex
CREATE INDEX "payroll_runs_employee_id_idx" ON "payroll_runs"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE INDEX "payslips_payroll_run_id_idx" ON "payslips"("payroll_run_id");

-- CreateIndex
CREATE INDEX "tax_brackets_country_id_idx" ON "tax_brackets"("country_id");

-- CreateIndex
CREATE INDEX "tax_brackets_country_id_tax_year_effective_from_idx" ON "tax_brackets"("country_id", "tax_year", "effective_from");

-- CreateIndex
CREATE INDEX "employee_tax_profiles_employee_id_idx" ON "employee_tax_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "superannuation_contributions_payroll_run_id_idx" ON "superannuation_contributions"("payroll_run_id");

-- AddForeignKey
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_rules" ADD CONSTRAINT "payroll_rules_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_rules" ADD CONSTRAINT "payroll_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_ot_rule_id_fkey" FOREIGN KEY ("ot_rule_id") REFERENCES "payroll_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "pay_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_tax_profiles" ADD CONSTRAINT "employee_tax_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "superannuation_contributions" ADD CONSTRAINT "superannuation_contributions_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
