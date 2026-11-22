-- CreateEnum
CREATE TYPE "compliance_recurrence" AS ENUM ('monthly', 'quarterly', 'yearly', 'fixed_date');

-- CreateEnum
CREATE TYPE "compliance_event_category" AS ENUM ('tax_filing', 'statutory_reporting', 'social_security_remittance', 'license_renewal', 'labor_audit', 'general');

-- CreateEnum
CREATE TYPE "compliance_event_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateTable
CREATE TABLE "compliance_events" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "state_province_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "compliance_event_category" NOT NULL DEFAULT 'tax_filing',
    "recurrence" "compliance_recurrence" NOT NULL,
    "due_date_rule" JSONB NOT NULL,
    "applicable_plans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "company_type" TEXT,
    "source_reference" TEXT,
    "notice_days_before" INTEGER NOT NULL DEFAULT 7,
    "penalties_summary" TEXT,
    "filing_portal_url" TEXT,
    "action_required" TEXT,
    "status" "compliance_event_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_event_notices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "compliance_event_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "notice_date" DATE NOT NULL,
    "days_remaining" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_event_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_events_country_id_status_idx" ON "compliance_events"("country_id", "status");

-- CreateIndex
CREATE INDEX "compliance_events_country_id_state_province_id_idx" ON "compliance_events"("country_id", "state_province_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_event_notices_tenant_id_compliance_event_id_due__key" ON "compliance_event_notices"("tenant_id", "compliance_event_id", "due_date");

-- CreateIndex
CREATE INDEX "compliance_event_notices_tenant_id_status_idx" ON "compliance_event_notices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "compliance_event_notices_company_id_due_date_idx" ON "compliance_event_notices"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "compliance_event_notices_compliance_event_id_due_date_idx" ON "compliance_event_notices"("compliance_event_id", "due_date");

-- AddForeignKey
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_state_province_id_fkey" FOREIGN KEY ("state_province_id") REFERENCES "states_provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_event_notices" ADD CONSTRAINT "compliance_event_notices_compliance_event_id_fkey" FOREIGN KEY ("compliance_event_id") REFERENCES "compliance_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_event_notices" ADD CONSTRAINT "compliance_event_notices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_event_notices" ADD CONSTRAINT "compliance_event_notices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
