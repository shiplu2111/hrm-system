-- Timesheet entries, projects, offline sync (MODULES.md §11, OFFLINE_SYNC.md)

CREATE TYPE "timesheet_entry_status" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'cancelled'
);

CREATE TYPE "timesheet_sync_event_type" AS ENUM ('log_entry', 'submit_entry');

ALTER TYPE "workflow_entity_type" ADD VALUE 'timesheet_entry';

CREATE TABLE "timesheet_projects" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "timesheet_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timesheet_entries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "local_id" UUID,
  "project_id" UUID NOT NULL,
  "entry_date" DATE NOT NULL,
  "task_name" TEXT NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "total_hours" DECIMAL(8, 2) NOT NULL,
  "is_billable" BOOLEAN NOT NULL DEFAULT true,
  "billable_hours" DECIMAL(8, 2) NOT NULL,
  "non_billable_hours" DECIMAL(8, 2) NOT NULL,
  "status" "timesheet_entry_status" NOT NULL DEFAULT 'draft',
  "time_anomaly" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timesheet_sync_events" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "local_id" UUID NOT NULL,
  "event_type" "timesheet_sync_event_type" NOT NULL,
  "timesheet_entry_id" UUID,
  "device_timestamp" TIMESTAMP(3) NOT NULL,
  "server_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "time_anomaly" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "timesheet_sync_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "timesheet_projects_company_id_name_key"
  ON "timesheet_projects"("company_id", "name");

CREATE INDEX "timesheet_projects_tenant_id_idx" ON "timesheet_projects"("tenant_id");
CREATE INDEX "timesheet_projects_company_id_idx" ON "timesheet_projects"("company_id");

CREATE UNIQUE INDEX "timesheet_entries_employee_id_local_id_key"
  ON "timesheet_entries"("employee_id", "local_id");

CREATE INDEX "timesheet_entries_tenant_id_idx" ON "timesheet_entries"("tenant_id");
CREATE INDEX "timesheet_entries_company_id_idx" ON "timesheet_entries"("company_id");
CREATE INDEX "timesheet_entries_employee_id_idx" ON "timesheet_entries"("employee_id");
CREATE INDEX "timesheet_entries_project_id_idx" ON "timesheet_entries"("project_id");
CREATE INDEX "timesheet_entries_entry_date_idx" ON "timesheet_entries"("entry_date");
CREATE INDEX "timesheet_entries_status_idx" ON "timesheet_entries"("status");

CREATE UNIQUE INDEX "timesheet_sync_events_employee_id_local_id_key"
  ON "timesheet_sync_events"("employee_id", "local_id");

CREATE INDEX "timesheet_sync_events_timesheet_entry_id_idx"
  ON "timesheet_sync_events"("timesheet_entry_id");

ALTER TABLE "timesheet_projects"
  ADD CONSTRAINT "timesheet_projects_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_projects"
  ADD CONSTRAINT "timesheet_projects_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_entries"
  ADD CONSTRAINT "timesheet_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_entries"
  ADD CONSTRAINT "timesheet_entries_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_entries"
  ADD CONSTRAINT "timesheet_entries_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_entries"
  ADD CONSTRAINT "timesheet_entries_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "timesheet_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_sync_events"
  ADD CONSTRAINT "timesheet_sync_events_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet_sync_events"
  ADD CONSTRAINT "timesheet_sync_events_timesheet_entry_id_fkey"
  FOREIGN KEY ("timesheet_entry_id") REFERENCES "timesheet_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
