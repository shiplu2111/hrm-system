-- Extend asset categories (MODULES.md §27: phone, SIM)
ALTER TYPE "asset_category" ADD VALUE IF NOT EXISTS 'phone';
ALTER TYPE "asset_category" ADD VALUE IF NOT EXISTS 'sim';

-- Link onboarding checklist items/tasks to asset categories
ALTER TABLE "onboarding_checklist_template_items" ADD COLUMN IF NOT EXISTS "asset_category" "asset_category";

ALTER TABLE "employee_onboarding_tasks" ADD COLUMN IF NOT EXISTS "asset_category" "asset_category";
ALTER TABLE "employee_onboarding_tasks" ADD COLUMN IF NOT EXISTS "company_asset_id" UUID;

CREATE INDEX IF NOT EXISTS "employee_onboarding_tasks_company_asset_id_idx" ON "employee_onboarding_tasks"("company_asset_id");

ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_company_asset_id_fkey"
  FOREIGN KEY ("company_asset_id") REFERENCES "company_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link asset assignments to onboarding tasks
ALTER TABLE "employee_asset_assignments" ADD COLUMN IF NOT EXISTS "onboarding_task_id" UUID;

CREATE INDEX IF NOT EXISTS "employee_asset_assignments_onboarding_task_id_idx" ON "employee_asset_assignments"("onboarding_task_id");

ALTER TABLE "employee_asset_assignments" ADD CONSTRAINT "employee_asset_assignments_onboarding_task_id_fkey"
  FOREIGN KEY ("onboarding_task_id") REFERENCES "employee_onboarding_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
