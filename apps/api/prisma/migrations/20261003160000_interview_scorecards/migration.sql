-- AlterTable
ALTER TABLE "job_application_interview_rounds" ADD COLUMN     "scorecard" JSONB;

-- CreateIndex
CREATE INDEX "job_application_interview_rounds_company_id_scheduled_start_idx" ON "job_application_interview_rounds"("company_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "job_application_interview_rounds_interviewer_employee_id_sc_idx" ON "job_application_interview_rounds"("interviewer_employee_id", "scheduled_start_at");

