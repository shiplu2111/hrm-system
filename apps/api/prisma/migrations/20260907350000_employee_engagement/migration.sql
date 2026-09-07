-- Employee Engagement (MODULES.md §29): announcements + surveys/eNPS

CREATE TYPE "company_announcement_status" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "company_announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "company_announcement_status" NOT NULL DEFAULT 'draft',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_announcements_tenant_id_idx" ON "company_announcements"("tenant_id");
CREATE INDEX "company_announcements_company_id_status_published_at_idx" ON "company_announcements"("company_id", "status", "published_at");

ALTER TABLE "company_announcements" ADD CONSTRAINT "company_announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_announcements" ADD CONSTRAINT "company_announcements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "engagement_survey_status" AS ENUM ('draft', 'published', 'closed');
CREATE TYPE "engagement_survey_type" AS ENUM ('pulse', 'enps');
CREATE TYPE "engagement_question_type" AS ENUM ('multiple_choice', 'rating', 'text', 'enps');

CREATE TABLE "engagement_surveys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "survey_type" "engagement_survey_type" NOT NULL DEFAULT 'pulse',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "status" "engagement_survey_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_surveys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "engagement_surveys_tenant_id_idx" ON "engagement_surveys"("tenant_id");
CREATE INDEX "engagement_surveys_company_id_status_idx" ON "engagement_surveys"("company_id", "status");
CREATE INDEX "engagement_surveys_company_id_survey_type_idx" ON "engagement_surveys"("company_id", "survey_type");

ALTER TABLE "engagement_surveys" ADD CONSTRAINT "engagement_surveys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engagement_surveys" ADD CONSTRAINT "engagement_surveys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "engagement_survey_questions" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "question_type" "engagement_question_type" NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_survey_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engagement_survey_questions_survey_id_sort_order_key" ON "engagement_survey_questions"("survey_id", "sort_order");
CREATE INDEX "engagement_survey_questions_survey_id_idx" ON "engagement_survey_questions"("survey_id");

ALTER TABLE "engagement_survey_questions" ADD CONSTRAINT "engagement_survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "engagement_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "engagement_survey_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "response_fingerprint" TEXT,
    "employee_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engagement_survey_responses_survey_id_response_fingerprint_key" ON "engagement_survey_responses"("survey_id", "response_fingerprint");
CREATE UNIQUE INDEX "engagement_survey_responses_survey_id_employee_id_key" ON "engagement_survey_responses"("survey_id", "employee_id");
CREATE INDEX "engagement_survey_responses_tenant_id_idx" ON "engagement_survey_responses"("tenant_id");
CREATE INDEX "engagement_survey_responses_survey_id_idx" ON "engagement_survey_responses"("survey_id");

ALTER TABLE "engagement_survey_responses" ADD CONSTRAINT "engagement_survey_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engagement_survey_responses" ADD CONSTRAINT "engagement_survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "engagement_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_survey_responses" ADD CONSTRAINT "engagement_survey_responses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "engagement_survey_answers" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "text_value" TEXT,
    "numeric_value" INTEGER,
    "selected_option" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_survey_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engagement_survey_answers_response_id_question_id_key" ON "engagement_survey_answers"("response_id", "question_id");
CREATE INDEX "engagement_survey_answers_question_id_idx" ON "engagement_survey_answers"("question_id");

ALTER TABLE "engagement_survey_answers" ADD CONSTRAINT "engagement_survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "engagement_survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_survey_answers" ADD CONSTRAINT "engagement_survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "engagement_survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
