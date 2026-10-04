-- Indexes declared in schema.prisma but missing from earlier migrations.
CREATE INDEX IF NOT EXISTS "contractor_contract_milestones_tenant_id_idx" ON "contractor_contract_milestones"("tenant_id");

CREATE INDEX IF NOT EXISTS "contractor_contract_milestones_company_id_idx" ON "contractor_contract_milestones"("company_id");

-- Postgres-truncated unique index name → Prisma's name.
DO $$
BEGIN
  IF to_regclass('public.safety_compliance_records_company_id_requirement_key_scope_key_') IS NOT NULL THEN
    ALTER INDEX "safety_compliance_records_company_id_requirement_key_scope_key_" RENAME TO "safety_compliance_records_company_id_requirement_key_scope__key";
  END IF;
END $$;
