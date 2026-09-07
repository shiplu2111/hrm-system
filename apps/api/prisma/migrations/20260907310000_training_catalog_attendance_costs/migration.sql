-- Training & Certification — course catalog, sessions, attendance, costs (MODULES.md §26)

CREATE TYPE "training_course_delivery_mode" AS ENUM ('self_paced', 'instructor_led', 'virtual', 'blended');
CREATE TYPE "training_course_status" AS ENUM ('draft', 'active', 'archived');
CREATE TYPE "training_session_status" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "training_attendance_status" AS ENUM ('registered', 'attended', 'completed', 'no_show', 'cancelled');
CREATE TYPE "training_cost_category" AS ENUM ('venue', 'instructor', 'materials', 'travel', 'catering', 'technology', 'other');

CREATE TABLE "training_courses" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "delivery_mode" "training_course_delivery_mode" NOT NULL DEFAULT 'instructor_led',
  "duration_minutes" INTEGER,
  "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
  "status" "training_course_status" NOT NULL DEFAULT 'active',
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_courses_company_id_title_key" ON "training_courses"("company_id", "title");
CREATE INDEX "training_courses_tenant_id_idx" ON "training_courses"("tenant_id");
CREATE INDEX "training_courses_company_id_status_idx" ON "training_courses"("company_id", "status");

CREATE TABLE "training_sessions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "title" TEXT,
  "scheduled_start" TIMESTAMP(3) NOT NULL,
  "scheduled_end" TIMESTAMP(3),
  "location" TEXT,
  "instructor" TEXT,
  "status" "training_session_status" NOT NULL DEFAULT 'scheduled',
  "notes" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "training_sessions_tenant_id_idx" ON "training_sessions"("tenant_id");
CREATE INDEX "training_sessions_company_id_idx" ON "training_sessions"("company_id");
CREATE INDEX "training_sessions_course_id_idx" ON "training_sessions"("course_id");
CREATE INDEX "training_sessions_scheduled_start_idx" ON "training_sessions"("scheduled_start");

CREATE TABLE "training_session_costs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "category" "training_cost_category" NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(14, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "training_session_costs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "training_session_costs_tenant_id_idx" ON "training_session_costs"("tenant_id");
CREATE INDEX "training_session_costs_company_id_idx" ON "training_session_costs"("company_id");
CREATE INDEX "training_session_costs_session_id_idx" ON "training_session_costs"("session_id");

CREATE TABLE "training_attendances" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "status" "training_attendance_status" NOT NULL DEFAULT 'registered',
  "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attended_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "score" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "training_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_attendances_session_id_employee_id_key" ON "training_attendances"("session_id", "employee_id");
CREATE INDEX "training_attendances_tenant_id_idx" ON "training_attendances"("tenant_id");
CREATE INDEX "training_attendances_company_id_idx" ON "training_attendances"("company_id");
CREATE INDEX "training_attendances_session_id_idx" ON "training_attendances"("session_id");
CREATE INDEX "training_attendances_employee_id_idx" ON "training_attendances"("employee_id");
CREATE INDEX "training_attendances_status_idx" ON "training_attendances"("status");

ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "training_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training_session_costs" ADD CONSTRAINT "training_session_costs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_session_costs" ADD CONSTRAINT "training_session_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_session_costs" ADD CONSTRAINT "training_session_costs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
