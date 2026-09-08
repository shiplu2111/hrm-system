-- MODULES.md §30 Health & Safety + country_rule_type health_safety (ARCHITECTURE.md §3)

ALTER TYPE "country_rule_type" ADD VALUE IF NOT EXISTS 'health_safety';

CREATE TYPE "workplace_incident_type" AS ENUM ('near_miss', 'injury', 'first_aid', 'slip_trip', 'equipment_damage', 'environmental', 'other');
CREATE TYPE "workplace_incident_severity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "workplace_incident_status" AS ENUM ('reported', 'under_investigation', 'resolved', 'closed');
CREATE TYPE "incident_party_role" AS ENUM ('involved', 'witness', 'injured');
CREATE TYPE "injury_medical_attention" AS ENUM ('none', 'first_aid', 'clinic', 'hospital');
CREATE TYPE "safety_compliance_requirement_type" AS ENUM ('training', 'inspection', 'certification', 'reporting');
CREATE TYPE "safety_compliance_status" AS ENUM ('pending', 'compliant', 'overdue', 'waived');
CREATE TYPE "safety_inspection_status" AS ENUM ('draft', 'completed');

CREATE TABLE "workplace_incidents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "incident_number" TEXT NOT NULL,
    "incident_type" "workplace_incident_type" NOT NULL,
    "severity" "workplace_incident_severity" NOT NULL,
    "status" "workplace_incident_status" NOT NULL DEFAULT 'reported',
    "location" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reported_by_employee_id" UUID NOT NULL,
    "gps_lat" DECIMAL(10,7),
    "gps_lng" DECIMAL(10,7),
    "regulator_report_required" BOOLEAN NOT NULL DEFAULT false,
    "regulator_report_due_at" TIMESTAMP(3),
    "regulator_report_submitted_at" TIMESTAMP(3),
    "regulator_name" TEXT,
    "investigation_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workplace_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workplace_incident_parties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "party_role" "incident_party_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workplace_incident_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "injury_log_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "incident_id" UUID,
    "employee_id" UUID NOT NULL,
    "injury_type" TEXT NOT NULL,
    "body_part" TEXT,
    "treatment_summary" TEXT,
    "medical_attention" "injury_medical_attention" NOT NULL DEFAULT 'none',
    "days_lost" INTEGER NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "injury_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "safety_compliance_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "requirement_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requirement_type" "safety_compliance_requirement_type" NOT NULL,
    "status" "safety_compliance_status" NOT NULL DEFAULT 'pending',
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "employee_id" UUID,
    "scope_key" TEXT NOT NULL DEFAULT 'company',
    "source_rule_type" TEXT NOT NULL DEFAULT 'health_safety',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_compliance_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "safety_inspections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL,
    "status" "safety_inspection_status" NOT NULL DEFAULT 'draft',
    "inspector_employee_id" UUID,
    "score_percent" INTEGER,
    "checklist_items" JSONB NOT NULL DEFAULT '[]',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_inspections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workplace_incidents_company_id_incident_number_key" ON "workplace_incidents"("company_id", "incident_number");
CREATE INDEX "workplace_incidents_tenant_id_idx" ON "workplace_incidents"("tenant_id");
CREATE INDEX "workplace_incidents_company_id_status_idx" ON "workplace_incidents"("company_id", "status");
CREATE INDEX "workplace_incidents_company_id_occurred_at_idx" ON "workplace_incidents"("company_id", "occurred_at");
CREATE INDEX "workplace_incidents_reported_by_employee_id_idx" ON "workplace_incidents"("reported_by_employee_id");

CREATE UNIQUE INDEX "workplace_incident_parties_incident_id_employee_id_key" ON "workplace_incident_parties"("incident_id", "employee_id");
CREATE INDEX "workplace_incident_parties_tenant_id_idx" ON "workplace_incident_parties"("tenant_id");
CREATE INDEX "workplace_incident_parties_employee_id_idx" ON "workplace_incident_parties"("employee_id");

CREATE INDEX "injury_log_entries_tenant_id_idx" ON "injury_log_entries"("tenant_id");
CREATE INDEX "injury_log_entries_company_id_recorded_at_idx" ON "injury_log_entries"("company_id", "recorded_at");
CREATE INDEX "injury_log_entries_employee_id_idx" ON "injury_log_entries"("employee_id");
CREATE INDEX "injury_log_entries_incident_id_idx" ON "injury_log_entries"("incident_id");

CREATE UNIQUE INDEX "safety_compliance_records_company_id_requirement_key_scope_key_key" ON "safety_compliance_records"("company_id", "requirement_key", "scope_key");
CREATE INDEX "safety_compliance_records_tenant_id_idx" ON "safety_compliance_records"("tenant_id");
CREATE INDEX "safety_compliance_records_company_id_status_idx" ON "safety_compliance_records"("company_id", "status");
CREATE INDEX "safety_compliance_records_employee_id_idx" ON "safety_compliance_records"("employee_id");

CREATE INDEX "safety_inspections_tenant_id_idx" ON "safety_inspections"("tenant_id");
CREATE INDEX "safety_inspections_company_id_inspected_at_idx" ON "safety_inspections"("company_id", "inspected_at");

ALTER TABLE "workplace_incidents" ADD CONSTRAINT "workplace_incidents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workplace_incidents" ADD CONSTRAINT "workplace_incidents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workplace_incidents" ADD CONSTRAINT "workplace_incidents_reported_by_employee_id_fkey" FOREIGN KEY ("reported_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workplace_incident_parties" ADD CONSTRAINT "workplace_incident_parties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workplace_incident_parties" ADD CONSTRAINT "workplace_incident_parties_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "workplace_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workplace_incident_parties" ADD CONSTRAINT "workplace_incident_parties_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "injury_log_entries" ADD CONSTRAINT "injury_log_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "injury_log_entries" ADD CONSTRAINT "injury_log_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "injury_log_entries" ADD CONSTRAINT "injury_log_entries_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "workplace_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "injury_log_entries" ADD CONSTRAINT "injury_log_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_compliance_records" ADD CONSTRAINT "safety_compliance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_compliance_records" ADD CONSTRAINT "safety_compliance_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_compliance_records" ADD CONSTRAINT "safety_compliance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_inspector_employee_id_fkey" FOREIGN KEY ("inspector_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
