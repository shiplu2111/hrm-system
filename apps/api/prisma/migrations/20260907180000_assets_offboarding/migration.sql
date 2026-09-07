-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('available', 'assigned', 'in_repair', 'retired');

-- CreateEnum
CREATE TYPE "asset_category" AS ENUM ('laptop', 'monitor', 'mobile', 'accessory', 'id_card', 'equipment');

-- CreateEnum
CREATE TYPE "asset_assignment_status" AS ENUM ('active', 'returned');

-- CreateEnum
CREATE TYPE "offboarding_task_category" AS ENUM ('clearance', 'asset_return', 'access_revocation', 'exit_process', 'final_settlement');

-- CreateEnum
CREATE TYPE "offboarding_task_type" AS ENUM ('clearance', 'asset_return', 'access_revocation', 'exit_interview', 'final_settlement', 'manual_task');

-- CreateEnum
CREATE TYPE "offboarding_status" AS ENUM ('in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "offboarding_task_status" AS ENUM ('pending', 'completed', 'skipped');

-- CreateTable
CREATE TABLE "company_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "category" "asset_category" NOT NULL,
    "serial_number" TEXT,
    "purchase_date" DATE,
    "warranty_expiry_date" DATE,
    "purchase_value" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "status" "asset_status" NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_asset_assignments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" "asset_assignment_status" NOT NULL DEFAULT 'active',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "condition_on_assign" TEXT,
    "condition_on_return" TEXT,
    "notes" TEXT,
    "assigned_by_user_id" UUID,
    "returned_by_user_id" UUID,
    "offboarding_task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_checklist_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_checklist_template_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "offboarding_task_category" NOT NULL,
    "task_type" "offboarding_task_type" NOT NULL,
    "asset_category" "asset_category",
    "assignee_label" TEXT,
    "due_days_offset" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_offboardings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "status" "offboarding_status" NOT NULL DEFAULT 'in_progress',
    "last_working_date" DATE,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "access_revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_offboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_offboarding_tasks" (
    "id" UUID NOT NULL,
    "offboarding_id" UUID NOT NULL,
    "template_item_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "offboarding_task_category" NOT NULL,
    "task_type" "offboarding_task_type" NOT NULL,
    "asset_category" "asset_category",
    "company_asset_id" UUID,
    "payroll_adjustment_id" UUID,
    "assignee_label" TEXT,
    "due_date" DATE,
    "status" "offboarding_task_status" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "completed_by_user_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_offboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_interview_records" (
    "id" UUID NOT NULL,
    "offboarding_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "conducted_at" TIMESTAMP(3),
    "interviewer_employee_id" UUID,
    "feedback" TEXT,
    "reason_for_leaving" TEXT,
    "would_rehire" BOOLEAN,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_interview_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_assets_company_id_asset_tag_key" ON "company_assets"("company_id", "asset_tag");

-- CreateIndex
CREATE INDEX "company_assets_tenant_id_idx" ON "company_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "company_assets_company_id_idx" ON "company_assets"("company_id");

-- CreateIndex
CREATE INDEX "company_assets_status_idx" ON "company_assets"("status");

-- CreateIndex
CREATE INDEX "employee_asset_assignments_asset_id_idx" ON "employee_asset_assignments"("asset_id");

-- CreateIndex
CREATE INDEX "employee_asset_assignments_employee_id_idx" ON "employee_asset_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "employee_asset_assignments_status_idx" ON "employee_asset_assignments"("status");

-- CreateIndex
CREATE INDEX "employee_asset_assignments_offboarding_task_id_idx" ON "employee_asset_assignments"("offboarding_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "offboarding_checklist_templates_company_id_name_key" ON "offboarding_checklist_templates"("company_id", "name");

-- CreateIndex
CREATE INDEX "offboarding_checklist_templates_tenant_id_idx" ON "offboarding_checklist_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "offboarding_checklist_templates_company_id_idx" ON "offboarding_checklist_templates"("company_id");

-- CreateIndex
CREATE INDEX "offboarding_checklist_template_items_template_id_idx" ON "offboarding_checklist_template_items"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_offboardings_employee_id_key" ON "employee_offboardings"("employee_id");

-- CreateIndex
CREATE INDEX "employee_offboardings_tenant_id_idx" ON "employee_offboardings"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_offboardings_company_id_idx" ON "employee_offboardings"("company_id");

-- CreateIndex
CREATE INDEX "employee_offboardings_status_idx" ON "employee_offboardings"("status");

-- CreateIndex
CREATE INDEX "employee_offboarding_tasks_offboarding_id_idx" ON "employee_offboarding_tasks"("offboarding_id");

-- CreateIndex
CREATE INDEX "employee_offboarding_tasks_company_asset_id_idx" ON "employee_offboarding_tasks"("company_asset_id");

-- CreateIndex
CREATE INDEX "employee_offboarding_tasks_payroll_adjustment_id_idx" ON "employee_offboarding_tasks"("payroll_adjustment_id");

-- CreateIndex
CREATE UNIQUE INDEX "exit_interview_records_offboarding_id_key" ON "exit_interview_records"("offboarding_id");

-- CreateIndex
CREATE INDEX "exit_interview_records_employee_id_idx" ON "exit_interview_records"("employee_id");

-- CreateIndex
CREATE INDEX "exit_interview_records_interviewer_employee_id_idx" ON "exit_interview_records"("interviewer_employee_id");

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_asset_assignments" ADD CONSTRAINT "employee_asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "company_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_asset_assignments" ADD CONSTRAINT "employee_asset_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_asset_assignments" ADD CONSTRAINT "employee_asset_assignments_offboarding_task_id_fkey" FOREIGN KEY ("offboarding_task_id") REFERENCES "employee_offboarding_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_checklist_templates" ADD CONSTRAINT "offboarding_checklist_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_checklist_templates" ADD CONSTRAINT "offboarding_checklist_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_checklist_template_items" ADD CONSTRAINT "offboarding_checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "offboarding_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "offboarding_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboarding_tasks" ADD CONSTRAINT "employee_offboarding_tasks_offboarding_id_fkey" FOREIGN KEY ("offboarding_id") REFERENCES "employee_offboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboarding_tasks" ADD CONSTRAINT "employee_offboarding_tasks_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "offboarding_checklist_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboarding_tasks" ADD CONSTRAINT "employee_offboarding_tasks_company_asset_id_fkey" FOREIGN KEY ("company_asset_id") REFERENCES "company_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboarding_tasks" ADD CONSTRAINT "employee_offboarding_tasks_payroll_adjustment_id_fkey" FOREIGN KEY ("payroll_adjustment_id") REFERENCES "payroll_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interview_records" ADD CONSTRAINT "exit_interview_records_offboarding_id_fkey" FOREIGN KEY ("offboarding_id") REFERENCES "employee_offboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interview_records" ADD CONSTRAINT "exit_interview_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interview_records" ADD CONSTRAINT "exit_interview_records_interviewer_employee_id_fkey" FOREIGN KEY ("interviewer_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
