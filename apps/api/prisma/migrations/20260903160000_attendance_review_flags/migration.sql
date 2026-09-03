-- Attendance review flags for payroll exclusion (OFFLINE_SYNC.md §5–§6)

CREATE TYPE "attendance_review_status" AS ENUM ('none', 'pending_manager', 'approved');

ALTER TABLE "attendance_records" ADD COLUMN "clock_in_server_at" TIMESTAMP(3),
ADD COLUMN "clock_out_server_at" TIMESTAMP(3),
ADD COLUMN "time_anomaly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "geofence_mismatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "payroll_eligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "review_status" "attendance_review_status" NOT NULL DEFAULT 'none';

CREATE INDEX "attendance_records_payroll_eligible_idx" ON "attendance_records"("payroll_eligible");
CREATE INDEX "attendance_records_review_status_idx" ON "attendance_records"("review_status");

ALTER TABLE "attendance_sync_events" ADD COLUMN "device_geofence_ok" BOOLEAN,
ADD COLUMN "server_geofence_ok" BOOLEAN,
ADD COLUMN "geofence_mismatch" BOOLEAN NOT NULL DEFAULT false;
