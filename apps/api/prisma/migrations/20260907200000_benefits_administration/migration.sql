-- Benefits administration (MODULES.md §21) — separate from superannuation

CREATE TYPE "benefit_plan_category" AS ENUM ('health_insurance', 'life_insurance', 'dental_vision', 'wellness', 'other');
CREATE TYPE "benefit_plan_status" AS ENUM ('draft', 'active', 'inactive');
CREATE TYPE "benefit_open_enrollment_status" AS ENUM ('scheduled', 'open', 'closed', 'cancelled');
CREATE TYPE "benefit_enrollment_status" AS ENUM ('pending', 'active', 'cancelled', 'terminated');
CREATE TYPE "benefit_enrollment_type" AS ENUM ('open_enrollment', 'new_hire', 'life_event', 'admin');
CREATE TYPE "benefit_dependent_relationship" AS ENUM ('spouse', 'child', 'parent', 'domestic_partner', 'other');
CREATE TYPE "benefit_dependent_status" AS ENUM ('active', 'cancelled');

CREATE TABLE "benefit_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "benefit_plan_category" NOT NULL,
    "provider" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL,
    "description" TEXT,
    "employer_contribution_label" TEXT,
    "employer_contribution_amount" DECIMAL(14,2),
    "employee_contribution_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employee_contribution_label" TEXT,
    "coverage_limit_label" TEXT,
    "status" "benefit_plan_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "benefit_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefit_open_enrollment_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "benefit_open_enrollment_status" NOT NULL DEFAULT 'scheduled',
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_open_enrollment_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefit_open_enrollment_plans" (
    "id" UUID NOT NULL,
    "open_enrollment_period_id" UUID NOT NULL,
    "benefit_plan_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_open_enrollment_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefit_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "benefit_plan_id" UUID NOT NULL,
    "open_enrollment_period_id" UUID,
    "enrollment_type" "benefit_enrollment_type" NOT NULL,
    "status" "benefit_enrollment_status" NOT NULL DEFAULT 'pending',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "employee_contribution_amount" DECIMAL(14,2),
    "beneficiary_share_percent" DECIMAL(5,2),
    "notes" TEXT,
    "enrolled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefit_enrollment_dependents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "relationship" "benefit_dependent_relationship" NOT NULL,
    "date_of_birth" DATE,
    "beneficiary_share_percent" DECIMAL(5,2),
    "status" "benefit_dependent_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_enrollment_dependents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "benefit_open_enrollment_plans_open_enrollment_period_id_benefit_plan_id_key"
    ON "benefit_open_enrollment_plans"("open_enrollment_period_id", "benefit_plan_id");

CREATE INDEX "benefit_plans_tenant_id_idx" ON "benefit_plans"("tenant_id");
CREATE INDEX "benefit_plans_company_id_idx" ON "benefit_plans"("company_id");
CREATE INDEX "benefit_plans_status_idx" ON "benefit_plans"("status");

CREATE INDEX "benefit_open_enrollment_periods_tenant_id_idx" ON "benefit_open_enrollment_periods"("tenant_id");
CREATE INDEX "benefit_open_enrollment_periods_company_id_idx" ON "benefit_open_enrollment_periods"("company_id");
CREATE INDEX "benefit_open_enrollment_periods_status_idx" ON "benefit_open_enrollment_periods"("status");
CREATE INDEX "benefit_open_enrollment_periods_start_date_end_date_idx" ON "benefit_open_enrollment_periods"("start_date", "end_date");

CREATE INDEX "benefit_open_enrollment_plans_benefit_plan_id_idx" ON "benefit_open_enrollment_plans"("benefit_plan_id");

CREATE INDEX "benefit_enrollments_tenant_id_idx" ON "benefit_enrollments"("tenant_id");
CREATE INDEX "benefit_enrollments_company_id_idx" ON "benefit_enrollments"("company_id");
CREATE INDEX "benefit_enrollments_employee_id_idx" ON "benefit_enrollments"("employee_id");
CREATE INDEX "benefit_enrollments_benefit_plan_id_idx" ON "benefit_enrollments"("benefit_plan_id");
CREATE INDEX "benefit_enrollments_open_enrollment_period_id_idx" ON "benefit_enrollments"("open_enrollment_period_id");
CREATE INDEX "benefit_enrollments_status_idx" ON "benefit_enrollments"("status");

CREATE INDEX "benefit_enrollment_dependents_tenant_id_idx" ON "benefit_enrollment_dependents"("tenant_id");
CREATE INDEX "benefit_enrollment_dependents_enrollment_id_idx" ON "benefit_enrollment_dependents"("enrollment_id");

ALTER TABLE "benefit_plans" ADD CONSTRAINT "benefit_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_plans" ADD CONSTRAINT "benefit_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "benefit_open_enrollment_periods" ADD CONSTRAINT "benefit_open_enrollment_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_open_enrollment_periods" ADD CONSTRAINT "benefit_open_enrollment_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "benefit_open_enrollment_plans" ADD CONSTRAINT "benefit_open_enrollment_plans_open_enrollment_period_id_fkey" FOREIGN KEY ("open_enrollment_period_id") REFERENCES "benefit_open_enrollment_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "benefit_open_enrollment_plans" ADD CONSTRAINT "benefit_open_enrollment_plans_benefit_plan_id_fkey" FOREIGN KEY ("benefit_plan_id") REFERENCES "benefit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_benefit_plan_id_fkey" FOREIGN KEY ("benefit_plan_id") REFERENCES "benefit_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_open_enrollment_period_id_fkey" FOREIGN KEY ("open_enrollment_period_id") REFERENCES "benefit_open_enrollment_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "benefit_enrollment_dependents" ADD CONSTRAINT "benefit_enrollment_dependents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "benefit_enrollment_dependents" ADD CONSTRAINT "benefit_enrollment_dependents_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "benefit_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
