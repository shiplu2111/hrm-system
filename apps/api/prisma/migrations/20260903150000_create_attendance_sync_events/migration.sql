-- Offline sync idempotency ledger (OFFLINE_SYNC.md §2–§4)

CREATE TYPE "attendance_sync_event_type" AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');

CREATE TABLE "attendance_sync_events" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "event_type" "attendance_sync_event_type" NOT NULL,
    "attendance_record_id" UUID,
    "device_timestamp" TIMESTAMP(3) NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL,
    "time_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sync_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_sync_events_employee_id_local_id_key" ON "attendance_sync_events"("employee_id", "local_id");

CREATE INDEX "attendance_sync_events_attendance_record_id_idx" ON "attendance_sync_events"("attendance_record_id");

ALTER TABLE "attendance_sync_events" ADD CONSTRAINT "attendance_sync_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_sync_events" ADD CONSTRAINT "attendance_sync_events_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
