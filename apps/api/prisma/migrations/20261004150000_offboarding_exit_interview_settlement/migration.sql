-- CreateEnum
CREATE TYPE "payroll_adjustment_kind" AS ENUM ('retroactive', 'final_settlement');

-- AlterTable
ALTER TABLE "payroll_adjustments" ADD COLUMN "kind" "payroll_adjustment_kind" NOT NULL DEFAULT 'retroactive',
ADD COLUMN "structure_overrides" JSONB,
ADD COLUMN "calculation_snapshot" JSONB;

-- Adjustments created from an offboarding settlement task
UPDATE "payroll_adjustments" SET "kind" = 'final_settlement'
WHERE "id" IN (
  SELECT "payroll_adjustment_id" FROM "employee_offboarding_tasks"
  WHERE "payroll_adjustment_id" IS NOT NULL AND "task_type" = 'final_settlement'
);

-- AlterTable
ALTER TABLE "exit_interview_records" ADD COLUMN "reason_category" TEXT,
ADD COLUMN "ratings" JSONB,
ADD COLUMN "liked_most" TEXT,
ADD COLUMN "improvement_suggestions" TEXT,
ADD COLUMN "would_recommend" BOOLEAN,
ADD COLUMN "recorded_by_user_id" UUID;
