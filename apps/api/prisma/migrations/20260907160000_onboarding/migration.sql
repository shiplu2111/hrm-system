-- CreateEnum
CREATE TYPE "onboarding_task_category" AS ENUM ('document_collection', 'policy_acceptance', 'equipment_provisioning', 'system_access', 'general');

-- CreateEnum
CREATE TYPE "onboarding_task_type" AS ENUM ('document_collection', 'policy_acceptance', 'manual_task', 'provisioning');

-- CreateEnum
CREATE TYPE "onboarding_status" AS ENUM ('in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "onboarding_task_status" AS ENUM ('pending', 'completed', 'skipped');

-- CreateTable
CREATE TABLE "onboarding_checklist_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_template_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "onboarding_task_category" NOT NULL,
    "task_type" "onboarding_task_type" NOT NULL,
    "document_type_id" UUID,
    "policy_document_url" TEXT,
    "assignee_label" TEXT,
    "due_days_offset" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboardings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "status" "onboarding_status" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "welcome_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboarding_tasks" (
    "id" UUID NOT NULL,
    "onboarding_id" UUID NOT NULL,
    "template_item_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "onboarding_task_category" NOT NULL,
    "task_type" "onboarding_task_type" NOT NULL,
    "document_type_id" UUID,
    "employee_document_id" UUID,
    "policy_document_url" TEXT,
    "policy_accepted_at" TIMESTAMP(3),
    "assignee_label" TEXT,
    "due_date" DATE,
    "status" "onboarding_task_status" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "completed_by_user_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_checklist_templates_tenant_id_idx" ON "onboarding_checklist_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "onboarding_checklist_templates_company_id_idx" ON "onboarding_checklist_templates"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklist_templates_company_id_name_key" ON "onboarding_checklist_templates"("company_id", "name");

-- CreateIndex
CREATE INDEX "onboarding_checklist_template_items_template_id_idx" ON "onboarding_checklist_template_items"("template_id");

-- CreateIndex
CREATE INDEX "onboarding_checklist_template_items_document_type_id_idx" ON "onboarding_checklist_template_items"("document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_onboardings_employee_id_key" ON "employee_onboardings"("employee_id");

-- CreateIndex
CREATE INDEX "employee_onboardings_tenant_id_idx" ON "employee_onboardings"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_onboardings_company_id_idx" ON "employee_onboardings"("company_id");

-- CreateIndex
CREATE INDEX "employee_onboardings_status_idx" ON "employee_onboardings"("status");

-- CreateIndex
CREATE INDEX "employee_onboarding_tasks_onboarding_id_idx" ON "employee_onboarding_tasks"("onboarding_id");

-- CreateIndex
CREATE INDEX "employee_onboarding_tasks_document_type_id_idx" ON "employee_onboarding_tasks"("document_type_id");

-- CreateIndex
CREATE INDEX "employee_onboarding_tasks_employee_document_id_idx" ON "employee_onboarding_tasks"("employee_document_id");

-- AddForeignKey
ALTER TABLE "onboarding_checklist_templates" ADD CONSTRAINT "onboarding_checklist_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_templates" ADD CONSTRAINT "onboarding_checklist_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_template_items" ADD CONSTRAINT "onboarding_checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_template_items" ADD CONSTRAINT "onboarding_checklist_template_items_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "employee_onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "onboarding_checklist_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_employee_document_id_fkey" FOREIGN KEY ("employee_document_id") REFERENCES "employee_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
