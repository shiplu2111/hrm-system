-- CreateEnum
CREATE TYPE "profile_update_field_key" AS ENUM (
  'first_name',
  'last_name',
  'work_location',
  'department',
  'designation',
  'manager',
  'dependents',
  'bank_or_tax',
  'other'
);

-- CreateEnum
CREATE TYPE "profile_update_request_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- CreateTable
CREATE TABLE "profile_update_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "field_key" "profile_update_field_key" NOT NULL,
  "current_value" TEXT,
  "requested_value" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "effective_date" DATE,
  "status" "profile_update_request_status" NOT NULL DEFAULT 'pending',
  "requested_by_user_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_comment" TEXT,
  "applied_on_approval" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "profile_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_update_requests_tenant_id_idx" ON "profile_update_requests"("tenant_id");
CREATE INDEX "profile_update_requests_company_id_status_idx" ON "profile_update_requests"("company_id", "status");
CREATE INDEX "profile_update_requests_employee_id_status_idx" ON "profile_update_requests"("employee_id", "status");

-- AddForeignKey
ALTER TABLE "profile_update_requests" ADD CONSTRAINT "profile_update_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

