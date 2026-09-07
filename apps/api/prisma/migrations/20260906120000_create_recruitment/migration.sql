-- CreateEnum
CREATE TYPE "job_requisition_status" AS ENUM ('draft', 'open', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "job_posting_status" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "candidate_source" AS ENUM ('referral', 'linkedin', 'job_board', 'agency', 'website', 'other');

-- CreateEnum
CREATE TYPE "application_stage" AS ENUM ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID,
    "designation_id" UUID,
    "job_level_id" UUID,
    "employment_type_id" UUID,
    "location_id" UUID,
    "description" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "status" "job_requisition_status" NOT NULL DEFAULT 'draft',
    "requested_by_employee_id" UUID,
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "status" "job_posting_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "expires_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" "candidate_source" NOT NULL DEFAULT 'other',
    "years_experience" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "posting_id" UUID,
    "stage" "application_stage" NOT NULL DEFAULT 'applied',
    "rating" DECIMAL(3,1),
    "cover_letter" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hired_employee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_resumes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_application_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_requisitions_company_id_reference_number_key" ON "job_requisitions"("company_id", "reference_number");

-- CreateIndex
CREATE INDEX "job_requisitions_tenant_id_idx" ON "job_requisitions"("tenant_id");

-- CreateIndex
CREATE INDEX "job_requisitions_company_id_idx" ON "job_requisitions"("company_id");

-- CreateIndex
CREATE INDEX "job_requisitions_department_id_idx" ON "job_requisitions"("department_id");

-- CreateIndex
CREATE INDEX "job_requisitions_status_idx" ON "job_requisitions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_requisition_id_key" ON "job_postings"("requisition_id");

-- CreateIndex
CREATE INDEX "job_postings_tenant_id_idx" ON "job_postings"("tenant_id");

-- CreateIndex
CREATE INDEX "job_postings_company_id_idx" ON "job_postings"("company_id");

-- CreateIndex
CREATE INDEX "job_postings_status_idx" ON "job_postings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_company_id_email_key" ON "candidates"("company_id", "email");

-- CreateIndex
CREATE INDEX "candidates_tenant_id_idx" ON "candidates"("tenant_id");

-- CreateIndex
CREATE INDEX "candidates_company_id_idx" ON "candidates"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_candidate_id_requisition_id_key" ON "job_applications"("candidate_id", "requisition_id");

-- CreateIndex
CREATE INDEX "job_applications_tenant_id_idx" ON "job_applications"("tenant_id");

-- CreateIndex
CREATE INDEX "job_applications_company_id_idx" ON "job_applications"("company_id");

-- CreateIndex
CREATE INDEX "job_applications_candidate_id_idx" ON "job_applications"("candidate_id");

-- CreateIndex
CREATE INDEX "job_applications_requisition_id_idx" ON "job_applications"("requisition_id");

-- CreateIndex
CREATE INDEX "job_applications_posting_id_idx" ON "job_applications"("posting_id");

-- CreateIndex
CREATE INDEX "job_applications_stage_idx" ON "job_applications"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_resumes_application_id_key" ON "job_application_resumes"("application_id");

-- CreateIndex
CREATE INDEX "job_application_resumes_tenant_id_idx" ON "job_application_resumes"("tenant_id");

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_job_level_id_fkey" FOREIGN KEY ("job_level_id") REFERENCES "job_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "employment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_requested_by_employee_id_fkey" FOREIGN KEY ("requested_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_posting_id_fkey" FOREIGN KEY ("posting_id") REFERENCES "job_postings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_hired_employee_id_fkey" FOREIGN KEY ("hired_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_resumes" ADD CONSTRAINT "job_application_resumes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_resumes" ADD CONSTRAINT "job_application_resumes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
