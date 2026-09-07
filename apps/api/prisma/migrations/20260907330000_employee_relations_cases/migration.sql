-- CreateEnum
CREATE TYPE "hr_case_type" AS ENUM ('grievance', 'complaint', 'disciplinary', 'investigation');

-- CreateEnum
CREATE TYPE "hr_case_status" AS ENUM ('open', 'under_review', 'action_required', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "hr_case_priority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "hr_case_outcome" AS ENUM ('not_determined', 'substantiated', 'partially_substantiated', 'unsubstantiated', 'resolved_informally');

-- CreateEnum
CREATE TYPE "hr_case_party_role" AS ENUM ('reporting_employee', 'subject_employee', 'witness', 'investigator', 'other');

-- CreateEnum
CREATE TYPE "disciplinary_action_type" AS ENUM ('verbal_warning', 'written_warning', 'final_warning', 'suspension', 'termination', 'other');

-- CreateTable
CREATE TABLE "hr_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "case_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "case_type" "hr_case_type" NOT NULL,
    "status" "hr_case_status" NOT NULL DEFAULT 'open',
    "priority" "hr_case_priority" NOT NULL DEFAULT 'medium',
    "outcome" "hr_case_outcome" NOT NULL DEFAULT 'not_determined',
    "subject_employee_id" UUID,
    "reporting_employee_id" UUID,
    "assigned_officer_employee_id" UUID,
    "details_encrypted" TEXT,
    "resolution_notes_encrypted" TEXT,
    "is_restricted" BOOLEAN NOT NULL DEFAULT true,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_case_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "content_encrypted" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_case_parties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "employee_id" UUID,
    "party_role" "hr_case_party_role" NOT NULL,
    "anonymized_label" TEXT,
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_case_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_case_disciplinary_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "action_type" "disciplinary_action_type" NOT NULL,
    "effective_date" DATE NOT NULL,
    "letter_reference" TEXT,
    "details_encrypted" TEXT,
    "issued_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_case_disciplinary_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_cases_company_id_case_number_key" ON "hr_cases"("company_id", "case_number");

-- CreateIndex
CREATE INDEX "hr_cases_tenant_id_idx" ON "hr_cases"("tenant_id");

-- CreateIndex
CREATE INDEX "hr_cases_company_id_idx" ON "hr_cases"("company_id");

-- CreateIndex
CREATE INDEX "hr_cases_status_idx" ON "hr_cases"("status");

-- CreateIndex
CREATE INDEX "hr_cases_case_type_idx" ON "hr_cases"("case_type");

-- CreateIndex
CREATE INDEX "hr_cases_priority_idx" ON "hr_cases"("priority");

-- CreateIndex
CREATE INDEX "hr_cases_assigned_officer_employee_id_idx" ON "hr_cases"("assigned_officer_employee_id");

-- CreateIndex
CREATE INDEX "hr_case_notes_tenant_id_idx" ON "hr_case_notes"("tenant_id");

-- CreateIndex
CREATE INDEX "hr_case_notes_case_id_idx" ON "hr_case_notes"("case_id");

-- CreateIndex
CREATE INDEX "hr_case_parties_tenant_id_idx" ON "hr_case_parties"("tenant_id");

-- CreateIndex
CREATE INDEX "hr_case_parties_case_id_idx" ON "hr_case_parties"("case_id");

-- CreateIndex
CREATE INDEX "hr_case_parties_employee_id_idx" ON "hr_case_parties"("employee_id");

-- CreateIndex
CREATE INDEX "hr_case_disciplinary_actions_tenant_id_idx" ON "hr_case_disciplinary_actions"("tenant_id");

-- CreateIndex
CREATE INDEX "hr_case_disciplinary_actions_company_id_idx" ON "hr_case_disciplinary_actions"("company_id");

-- CreateIndex
CREATE INDEX "hr_case_disciplinary_actions_case_id_idx" ON "hr_case_disciplinary_actions"("case_id");

-- CreateIndex
CREATE INDEX "hr_case_disciplinary_actions_action_type_idx" ON "hr_case_disciplinary_actions"("action_type");

-- AddForeignKey
ALTER TABLE "hr_cases" ADD CONSTRAINT "hr_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_cases" ADD CONSTRAINT "hr_cases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_cases" ADD CONSTRAINT "hr_cases_subject_employee_id_fkey" FOREIGN KEY ("subject_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_cases" ADD CONSTRAINT "hr_cases_reporting_employee_id_fkey" FOREIGN KEY ("reporting_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_cases" ADD CONSTRAINT "hr_cases_assigned_officer_employee_id_fkey" FOREIGN KEY ("assigned_officer_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_notes" ADD CONSTRAINT "hr_case_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_notes" ADD CONSTRAINT "hr_case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "hr_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_parties" ADD CONSTRAINT "hr_case_parties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_parties" ADD CONSTRAINT "hr_case_parties_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "hr_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_parties" ADD CONSTRAINT "hr_case_parties_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_disciplinary_actions" ADD CONSTRAINT "hr_case_disciplinary_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_disciplinary_actions" ADD CONSTRAINT "hr_case_disciplinary_actions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_case_disciplinary_actions" ADD CONSTRAINT "hr_case_disciplinary_actions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "hr_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
