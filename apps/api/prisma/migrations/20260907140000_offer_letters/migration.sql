-- CreateEnum
CREATE TYPE "offer_letter_status" AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "offer_letter_template" AS ENUM ('standard', 'senior', 'contract', 'remote');

-- AlterEnum
ALTER TYPE "workflow_entity_type" ADD VALUE 'offer_letter';

-- CreateTable
CREATE TABLE "offer_letters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "status" "offer_letter_status" NOT NULL DEFAULT 'draft',
    "template" "offer_letter_template" NOT NULL DEFAULT 'standard',
    "job_title" TEXT NOT NULL,
    "department_id" UUID,
    "designation_id" UUID,
    "employment_type_id" UUID,
    "work_location_id" UUID,
    "annual_salary" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "start_date" DATE NOT NULL,
    "reporting_to" TEXT,
    "signing_bonus" DECIMAL(12,2),
    "equity_notes" TEXT,
    "probation_months" INTEGER,
    "expiry_date" DATE,
    "additional_terms" TEXT,
    "file_key" TEXT,
    "generated_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_application_id_key" ON "offer_letters"("application_id");

-- CreateIndex
CREATE INDEX "offer_letters_tenant_id_idx" ON "offer_letters"("tenant_id");

-- CreateIndex
CREATE INDEX "offer_letters_company_id_idx" ON "offer_letters"("company_id");

-- CreateIndex
CREATE INDEX "offer_letters_status_idx" ON "offer_letters"("status");

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "employment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
