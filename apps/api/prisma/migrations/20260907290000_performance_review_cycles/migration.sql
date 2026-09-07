-- Performance review cycles, participants, assessments (MODULES.md §25)
-- Workflow engine: performance_review entity + skip-level assignee

ALTER TYPE "workflow_entity_type" ADD VALUE IF NOT EXISTS 'performance_review';
ALTER TYPE "workflow_assignee_type" ADD VALUE IF NOT EXISTS 'skip_level_manager';

CREATE TYPE "employee_performance_review_status" AS ENUM (
  'not_started',
  'self_assessment_draft',
  'self_submitted',
  'manager_review',
  'pending_approval',
  'approved',
  'returned',
  'cancelled'
);

ALTER TABLE "performance_review_cycles"
  ADD COLUMN "requires_workflow_approval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "launched_at" TIMESTAMP(3);

CREATE TABLE "performance_review_participants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "review_cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_review_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_performance_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "review_cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "manager_employee_id" UUID,
    "status" "employee_performance_review_status" NOT NULL DEFAULT 'not_started',
    "self_assessment" JSONB NOT NULL DEFAULT '{}',
    "manager_assessment" JSONB NOT NULL DEFAULT '{}',
    "self_submitted_at" TIMESTAMP(3),
    "manager_submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "return_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_review_participants_review_cycle_id_employee_id_key"
  ON "performance_review_participants"("review_cycle_id", "employee_id");
CREATE INDEX "performance_review_participants_tenant_id_idx" ON "performance_review_participants"("tenant_id");
CREATE INDEX "performance_review_participants_company_id_idx" ON "performance_review_participants"("company_id");
CREATE INDEX "performance_review_participants_employee_id_idx" ON "performance_review_participants"("employee_id");

CREATE UNIQUE INDEX "employee_performance_reviews_review_cycle_id_employee_id_key"
  ON "employee_performance_reviews"("review_cycle_id", "employee_id");
CREATE INDEX "employee_performance_reviews_tenant_id_idx" ON "employee_performance_reviews"("tenant_id");
CREATE INDEX "employee_performance_reviews_company_id_idx" ON "employee_performance_reviews"("company_id");
CREATE INDEX "employee_performance_reviews_review_cycle_id_idx" ON "employee_performance_reviews"("review_cycle_id");
CREATE INDEX "employee_performance_reviews_employee_id_idx" ON "employee_performance_reviews"("employee_id");
CREATE INDEX "employee_performance_reviews_manager_employee_id_idx" ON "employee_performance_reviews"("manager_employee_id");
CREATE INDEX "employee_performance_reviews_status_idx" ON "employee_performance_reviews"("status");

ALTER TABLE "performance_review_participants"
  ADD CONSTRAINT "performance_review_participants_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_review_participants"
  ADD CONSTRAINT "performance_review_participants_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_review_participants"
  ADD CONSTRAINT "performance_review_participants_review_cycle_id_fkey"
  FOREIGN KEY ("review_cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_review_participants"
  ADD CONSTRAINT "performance_review_participants_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_review_cycle_id_fkey"
  FOREIGN KEY ("review_cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_manager_employee_id_fkey"
  FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
