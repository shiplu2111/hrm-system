-- Performance Management — KPI & goal setting (MODULES.md §25)

CREATE TYPE "performance_review_cycle_status" AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE "kpi_measurement_period" AS ENUM ('monthly', 'quarterly', 'semi_annual', 'annual', 'custom');
CREATE TYPE "kpi_unit" AS ENUM ('percentage', 'count', 'currency', 'hours', 'days', 'score', 'other');
CREATE TYPE "kpi_direction" AS ENUM ('higher_is_better', 'lower_is_better');
CREATE TYPE "employee_kpi_assignment_status" AS ENUM ('draft', 'active', 'completed', 'cancelled');

CREATE TABLE "performance_review_cycles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "measurement_period" "kpi_measurement_period" NOT NULL,
    "review_due_date" DATE NOT NULL,
    "status" "performance_review_cycle_status" NOT NULL DEFAULT 'draft',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_review_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kpi_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" "kpi_unit" NOT NULL,
    "direction" "kpi_direction" NOT NULL DEFAULT 'higher_is_better',
    "default_target_value" DECIMAL(14,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_kpi_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "review_cycle_id" UUID NOT NULL,
    "kpi_definition_id" UUID,
    "employee_id" UUID NOT NULL,
    "assigned_by_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unit" "kpi_unit" NOT NULL,
    "direction" "kpi_direction" NOT NULL DEFAULT 'higher_is_better',
    "target_value" DECIMAL(14,4) NOT NULL,
    "current_value" DECIMAL(14,4),
    "measurement_period" "kpi_measurement_period" NOT NULL,
    "measurement_period_start" DATE NOT NULL,
    "measurement_period_end" DATE NOT NULL,
    "weight_percent" DECIMAL(5,2),
    "status" "employee_kpi_assignment_status" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_kpi_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kpi_definitions_company_id_name_key" ON "kpi_definitions"("company_id", "name");

CREATE INDEX "performance_review_cycles_tenant_id_idx" ON "performance_review_cycles"("tenant_id");
CREATE INDEX "performance_review_cycles_company_id_idx" ON "performance_review_cycles"("company_id");
CREATE INDEX "performance_review_cycles_company_id_status_idx" ON "performance_review_cycles"("company_id", "status");

CREATE INDEX "kpi_definitions_tenant_id_idx" ON "kpi_definitions"("tenant_id");
CREATE INDEX "kpi_definitions_company_id_is_active_idx" ON "kpi_definitions"("company_id", "is_active");

CREATE INDEX "employee_kpi_assignments_tenant_id_idx" ON "employee_kpi_assignments"("tenant_id");
CREATE INDEX "employee_kpi_assignments_company_id_idx" ON "employee_kpi_assignments"("company_id");
CREATE INDEX "employee_kpi_assignments_review_cycle_id_idx" ON "employee_kpi_assignments"("review_cycle_id");
CREATE INDEX "employee_kpi_assignments_employee_id_idx" ON "employee_kpi_assignments"("employee_id");
CREATE INDEX "employee_kpi_assignments_kpi_definition_id_idx" ON "employee_kpi_assignments"("kpi_definition_id");
CREATE INDEX "employee_kpi_assignments_status_idx" ON "employee_kpi_assignments"("status");

ALTER TABLE "performance_review_cycles" ADD CONSTRAINT "performance_review_cycles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_review_cycles" ADD CONSTRAINT "performance_review_cycles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_kpi_assignments" ADD CONSTRAINT "employee_kpi_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_kpi_assignments" ADD CONSTRAINT "employee_kpi_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_kpi_assignments" ADD CONSTRAINT "employee_kpi_assignments_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_kpi_assignments" ADD CONSTRAINT "employee_kpi_assignments_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_kpi_assignments" ADD CONSTRAINT "employee_kpi_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
