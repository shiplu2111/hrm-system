-- Certificate file (one per certification) and per-designation skill targets for the skill-gap report.
ALTER TABLE "employee_certifications"
  ADD COLUMN "file_content_type" TEXT,
  ADD COLUMN "file_key" TEXT,
  ADD COLUMN "file_name" TEXT,
  ADD COLUMN "file_size_bytes" INTEGER,
  ADD COLUMN "file_uploaded_at" TIMESTAMP(3);

CREATE TABLE "designation_skill_targets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "designation_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "target_level" "skill_proficiency_level" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designation_skill_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "designation_skill_targets_tenant_id_idx" ON "designation_skill_targets"("tenant_id");
CREATE INDEX "designation_skill_targets_company_id_idx" ON "designation_skill_targets"("company_id");
CREATE INDEX "designation_skill_targets_skill_id_idx" ON "designation_skill_targets"("skill_id");
CREATE UNIQUE INDEX "designation_skill_targets_designation_id_skill_id_key" ON "designation_skill_targets"("designation_id", "skill_id");

ALTER TABLE "designation_skill_targets" ADD CONSTRAINT "designation_skill_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "designation_skill_targets" ADD CONSTRAINT "designation_skill_targets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "designation_skill_targets" ADD CONSTRAINT "designation_skill_targets_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "designation_skill_targets" ADD CONSTRAINT "designation_skill_targets_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
