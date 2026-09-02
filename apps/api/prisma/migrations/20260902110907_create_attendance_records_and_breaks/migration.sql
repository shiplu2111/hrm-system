-- CreateEnum
CREATE TYPE "attendance_source" AS ENUM ('manual', 'mobile', 'biometric', 'qr', 'gps');

-- CreateEnum
CREATE TYPE "attendance_record_status" AS ENUM ('present', 'absent', 'late', 'early_leave', 'half_day', 'holiday', 'weekend', 'leave', 'wfh', 'business_trip');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('pending', 'syncing', 'synced', 'failed');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "clock_in_at" TIMESTAMP(3),
    "clock_out_at" TIMESTAMP(3),
    "source" "attendance_source" NOT NULL,
    "status" "attendance_record_status" NOT NULL,
    "gps_lat" DECIMAL(10,7),
    "gps_lng" DECIMAL(10,7),
    "device_id" TEXT,
    "local_id" UUID,
    "synced_at" TIMESTAMP(3),
    "sync_status" "sync_status",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breaks" (
    "id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_date_idx" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_sync_status_idx" ON "attendance_records"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_local_id_key" ON "attendance_records"("employee_id", "local_id");

-- CreateIndex
CREATE INDEX "breaks_attendance_record_id_idx" ON "breaks"("attendance_record_id");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breaks" ADD CONSTRAINT "breaks_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
