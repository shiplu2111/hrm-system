-- Shift master extensions (MODULES.md §12) and tenant holiday calendar (MODULES.md §14)

CREATE TYPE "shift_type" AS ENUM ('fixed', 'rotating', 'night', 'split', 'flexible', 'overnight');

ALTER TABLE "shifts"
  ADD COLUMN "shift_type" "shift_type" NOT NULL DEFAULT 'fixed',
  ADD COLUMN "minimum_minutes" INTEGER,
  ADD COLUMN "late_rule" JSONB,
  ADD COLUMN "early_leave_rule" JSONB,
  ADD COLUMN "weekend_rule" JSONB;

CREATE TYPE "holiday_scope" AS ENUM ('company', 'branch', 'employee');

CREATE TABLE "holidays" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "scope" "holiday_scope" NOT NULL,
  "location_id" UUID,
  "employee_id" UUID,
  "name" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "holidays_tenant_id_company_id_date_idx" ON "holidays"("tenant_id", "company_id", "date");
CREATE INDEX "holidays_location_id_date_idx" ON "holidays"("location_id", "date");
CREATE INDEX "holidays_employee_id_date_idx" ON "holidays"("employee_id", "date");

ALTER TABLE "holidays"
  ADD CONSTRAINT "holidays_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "holidays_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "holidays_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "holidays_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
