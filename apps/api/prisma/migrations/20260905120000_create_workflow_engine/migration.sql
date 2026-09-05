-- Approval Workflow Engine (MODULES.md §35)

CREATE TYPE "workflow_entity_type" AS ENUM (
  'leave_request',
  'expense_claim',
  'payroll_adjustment',
  'contract'
);

CREATE TYPE "workflow_assignee_type" AS ENUM ('role', 'direct_manager');

CREATE TYPE "workflow_instance_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

CREATE TABLE "workflow_definitions" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "entity_type" "workflow_entity_type" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "steps" JSONB NOT NULL DEFAULT '[]',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_instances" (
  "id" UUID NOT NULL,
  "definition_id" UUID,
  "company_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "entity_type" "workflow_entity_type" NOT NULL,
  "entity_id" UUID NOT NULL,
  "requester_employee_id" UUID NOT NULL,
  "requester_user_id" UUID,
  "status" "workflow_instance_status" NOT NULL DEFAULT 'pending',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "current_step_order" INTEGER NOT NULL DEFAULT 1,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_instances_entity_type_entity_id_key"
  ON "workflow_instances"("entity_type", "entity_id");

CREATE INDEX "workflow_definitions_company_id_entity_type_idx"
  ON "workflow_definitions"("company_id", "entity_type");

CREATE INDEX "workflow_definitions_company_id_entity_type_is_default_is_active_idx"
  ON "workflow_definitions"("company_id", "entity_type", "is_default", "is_active");

CREATE INDEX "workflow_instances_company_id_status_idx"
  ON "workflow_instances"("company_id", "status");

CREATE INDEX "workflow_instances_requester_employee_id_idx"
  ON "workflow_instances"("requester_employee_id");

ALTER TABLE "workflow_definitions"
  ADD CONSTRAINT "workflow_definitions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_instances"
  ADD CONSTRAINT "workflow_instances_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workflow_instances"
  ADD CONSTRAINT "workflow_instances_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_instances"
  ADD CONSTRAINT "workflow_instances_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
