-- AlterEnum
ALTER TYPE "workflow_entity_type" ADD VALUE IF NOT EXISTS 'shift_swap_request';
ALTER TYPE "workflow_entity_type" ADD VALUE IF NOT EXISTS 'overtime_request';

-- CreateEnum
CREATE TYPE "shift_swap_request_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE "overtime_rate_type" AS ENUM ('weekday', 'weekend', 'holiday', 'night');
CREATE TYPE "overtime_request_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "shift_swap_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "requester_employee_id" UUID NOT NULL,
  "target_employee_id" UUID NOT NULL,
  "requester_roster_id" UUID,
  "requester_shift_name" TEXT,
  "requester_shift_window" TEXT,
  "target_roster_id" UUID,
  "target_shift_name" TEXT,
  "target_shift_window" TEXT,
  "swap_date" DATE NOT NULL,
  "target_date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "shift_swap_request_status" NOT NULL DEFAULT 'pending',
  "requested_by_user_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "start_time" TEXT,
  "end_time" TEXT,
  "hours" DECIMAL(5,2) NOT NULL,
  "rate_type" "overtime_rate_type" NOT NULL DEFAULT 'weekday',
  "reason" TEXT NOT NULL,
  "status" "overtime_request_status" NOT NULL DEFAULT 'pending',
  "requested_by_user_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_swap_requests_tenant_id_idx" ON "shift_swap_requests"("tenant_id");
CREATE INDEX "shift_swap_requests_company_id_status_idx" ON "shift_swap_requests"("company_id", "status");
CREATE INDEX "shift_swap_requests_requester_employee_id_status_idx" ON "shift_swap_requests"("requester_employee_id", "status");
CREATE INDEX "shift_swap_requests_target_employee_id_status_idx" ON "shift_swap_requests"("target_employee_id", "status");

CREATE INDEX "overtime_requests_tenant_id_idx" ON "overtime_requests"("tenant_id");
CREATE INDEX "overtime_requests_company_id_status_idx" ON "overtime_requests"("company_id", "status");
CREATE INDEX "overtime_requests_employee_id_date_idx" ON "overtime_requests"("employee_id", "date");

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_employee_id_fkey"
  FOREIGN KEY ("requester_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_employee_id_fkey"
  FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

