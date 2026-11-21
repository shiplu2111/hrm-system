-- AlterEnum rule_version_status
ALTER TYPE "rule_version_status" ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE "rule_version_status" ADD VALUE IF NOT EXISTS 'superseded';

-- AlterEnum country_rule_type
ALTER TYPE "country_rule_type" ADD VALUE IF NOT EXISTS 'pension';
ALTER TYPE "country_rule_type" ADD VALUE IF NOT EXISTS 'working_hours';
ALTER TYPE "country_rule_type" ADD VALUE IF NOT EXISTS 'payroll';
ALTER TYPE "country_rule_type" ADD VALUE IF NOT EXISTS 'termination';
ALTER TYPE "country_rule_type" ADD VALUE IF NOT EXISTS 'compliance';

-- AlterTable country_rules
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "state_province_id" UUID;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "source_reference" TEXT NOT NULL DEFAULT 'Statutory Legislation Baseline';
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "change_note" TEXT NOT NULL DEFAULT 'Initial published statutory baseline version';
ALTER TABLE "country_rules" ADD COLUMN IF NOT EXISTS "created_by" TEXT NOT NULL DEFAULT 'system';

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'country_rules_state_province_id_fkey'
  ) THEN
    ALTER TABLE "country_rules" ADD CONSTRAINT "country_rules_state_province_id_fkey"
    FOREIGN KEY ("state_province_id") REFERENCES "states_provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "country_rules_state_province_id_idx" ON "country_rules"("state_province_id");
CREATE INDEX IF NOT EXISTS "country_rules_country_id_rule_type_status_idx" ON "country_rules"("country_id", "rule_type", "status");
CREATE INDEX IF NOT EXISTS "country_rules_country_id_state_province_id_rule_type_status_idx" ON "country_rules"("country_id", "state_province_id", "rule_type", "status");

-- AlterTable tax_brackets
ALTER TABLE "tax_brackets" ADD COLUMN IF NOT EXISTS "source_reference" TEXT NOT NULL DEFAULT 'ATO Statutory Tax Tables';
ALTER TABLE "tax_brackets" ADD COLUMN IF NOT EXISTS "change_note" TEXT NOT NULL DEFAULT 'Statutory progressive income tax brackets';
ALTER TABLE "tax_brackets" ADD COLUMN IF NOT EXISTS "created_by" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "tax_brackets" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
