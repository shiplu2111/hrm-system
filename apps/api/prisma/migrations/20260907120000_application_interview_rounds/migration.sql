-- CreateEnum
CREATE TYPE "interview_round_type" AS ENUM ('technical', 'hr', 'management', 'final_decision');

-- CreateEnum
CREATE TYPE "interview_round_status" AS ENUM ('pending', 'scheduled', 'completed', 'cancelled', 'skipped');

-- CreateEnum
CREATE TYPE "interview_recommendation" AS ENUM ('strong_yes', 'yes', 'neutral', 'no', 'strong_no');

-- CreateTable
CREATE TABLE "job_application_interview_rounds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "round_type" "interview_round_type" NOT NULL,
    "round_order" INTEGER NOT NULL,
    "status" "interview_round_status" NOT NULL DEFAULT 'pending',
    "scheduled_start_at" TIMESTAMP(3),
    "scheduled_end_at" TIMESTAMP(3),
    "location" TEXT,
    "meeting_url" TEXT,
    "interviewer_employee_id" UUID,
    "score" DECIMAL(3,1),
    "recommendation" "interview_recommendation",
    "feedback" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_application_interview_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_application_interview_rounds_application_id_round_type_key" ON "job_application_interview_rounds"("application_id", "round_type");

-- CreateIndex
CREATE INDEX "job_application_interview_rounds_tenant_id_idx" ON "job_application_interview_rounds"("tenant_id");

-- CreateIndex
CREATE INDEX "job_application_interview_rounds_company_id_idx" ON "job_application_interview_rounds"("company_id");

-- CreateIndex
CREATE INDEX "job_application_interview_rounds_application_id_idx" ON "job_application_interview_rounds"("application_id");

-- CreateIndex
CREATE INDEX "job_application_interview_rounds_status_idx" ON "job_application_interview_rounds"("status");

-- AddForeignKey
ALTER TABLE "job_application_interview_rounds" ADD CONSTRAINT "job_application_interview_rounds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_interview_rounds" ADD CONSTRAINT "job_application_interview_rounds_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_interview_rounds" ADD CONSTRAINT "job_application_interview_rounds_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_interview_rounds" ADD CONSTRAINT "job_application_interview_rounds_interviewer_employee_id_fkey" FOREIGN KEY ("interviewer_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_interview_rounds" ADD CONSTRAINT "job_application_interview_rounds_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
