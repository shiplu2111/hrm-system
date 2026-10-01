-- Attendance corrections / regularization (ATTENDANCE_LOGIC.md §7–§8)

CREATE TYPE "attendance_correction_kind" AS ENUM ('regularization', 'flag_approval');
CREATE TYPE "attendance_correction_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "date" DATE NOT NULL,
    "kind" "attendance_correction_kind" NOT NULL,
    "status" "attendance_correction_status" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "original_values" JSONB NOT NULL DEFAULT '{}',
    "requested_clock_in_at" TIMESTAMP(3),
    "requested_clock_out_at" TIMESTAMP(3),
    "requested_status" "attendance_record_status",
    "use_server_time" BOOLEAN NOT NULL DEFAULT false,
    "requested_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_corrections_tenant_id_idx" ON "attendance_corrections"("tenant_id");
CREATE INDEX "attendance_corrections_company_id_status_idx" ON "attendance_corrections"("company_id", "status");
CREATE INDEX "attendance_corrections_employee_id_date_idx" ON "attendance_corrections"("employee_id", "date");
CREATE INDEX "attendance_corrections_attendance_record_id_idx" ON "attendance_corrections"("attendance_record_id");
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey"
    FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
