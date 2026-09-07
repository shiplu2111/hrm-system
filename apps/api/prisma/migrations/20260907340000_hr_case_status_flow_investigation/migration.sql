-- HR case status flow: Open -> Investigating -> Resolved -> Closed

CREATE TYPE "hr_case_status_new" AS ENUM ('open', 'investigating', 'resolved', 'closed');

ALTER TABLE "hr_cases" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "hr_cases"
  ALTER COLUMN "status" TYPE "hr_case_status_new"
  USING (
    CASE "status"::text
      WHEN 'open' THEN 'open'::"hr_case_status_new"
      WHEN 'under_review' THEN 'investigating'::"hr_case_status_new"
      WHEN 'action_required' THEN 'investigating'::"hr_case_status_new"
      WHEN 'resolved' THEN 'resolved'::"hr_case_status_new"
      WHEN 'closed' THEN 'closed'::"hr_case_status_new"
      ELSE 'open'::"hr_case_status_new"
    END
  );

ALTER TABLE "hr_cases" ALTER COLUMN "status" SET DEFAULT 'open';

DROP TYPE "hr_case_status";

ALTER TYPE "hr_case_status_new" RENAME TO "hr_case_status";

-- Investigation records

CREATE TYPE "hr_investigation_record_type" AS ENUM (
  'interview',
  'evidence_review',
  'finding',
  'legal_review',
  'other'
);

CREATE TABLE "hr_case_investigation_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "record_type" "hr_investigation_record_type" NOT NULL,
    "title" TEXT NOT NULL,
    "content_encrypted" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_case_investigation_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_case_investigation_records_tenant_id_idx" ON "hr_case_investigation_records"("tenant_id");
CREATE INDEX "hr_case_investigation_records_case_id_idx" ON "hr_case_investigation_records"("case_id");
CREATE INDEX "hr_case_investigation_records_record_type_idx" ON "hr_case_investigation_records"("record_type");

ALTER TABLE "hr_case_investigation_records" ADD CONSTRAINT "hr_case_investigation_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_case_investigation_records" ADD CONSTRAINT "hr_case_investigation_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "hr_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
