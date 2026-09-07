-- CreateEnum
CREATE TYPE "skill_proficiency_level" AS ENUM ('none', 'beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "employee_certification_status" AS ENUM ('active', 'expired', 'revoked');

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "level" "skill_proficiency_level" NOT NULL DEFAULT 'beginner',
    "assessed_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "course_id" UUID,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "certificate_number" TEXT,
    "issued_at" DATE,
    "expiry_date" DATE,
    "status" "employee_certification_status" NOT NULL DEFAULT 'active',
    "expiry_alert_sent_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skills_tenant_id_idx" ON "skills"("tenant_id");

-- CreateIndex
CREATE INDEX "skills_company_id_idx" ON "skills"("company_id");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE UNIQUE INDEX "skills_company_id_name_key" ON "skills"("company_id", "name");

-- CreateIndex
CREATE INDEX "employee_skills_tenant_id_idx" ON "employee_skills"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_skills_company_id_idx" ON "employee_skills"("company_id");

-- CreateIndex
CREATE INDEX "employee_skills_employee_id_idx" ON "employee_skills"("employee_id");

-- CreateIndex
CREATE INDEX "employee_skills_skill_id_idx" ON "employee_skills"("skill_id");

-- CreateIndex
CREATE INDEX "employee_skills_level_idx" ON "employee_skills"("level");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skills_employee_id_skill_id_key" ON "employee_skills"("employee_id", "skill_id");

-- CreateIndex
CREATE INDEX "employee_certifications_tenant_id_idx" ON "employee_certifications"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_certifications_company_id_idx" ON "employee_certifications"("company_id");

-- CreateIndex
CREATE INDEX "employee_certifications_employee_id_idx" ON "employee_certifications"("employee_id");

-- CreateIndex
CREATE INDEX "employee_certifications_course_id_idx" ON "employee_certifications"("course_id");

-- CreateIndex
CREATE INDEX "employee_certifications_status_idx" ON "employee_certifications"("status");

-- CreateIndex
CREATE INDEX "employee_certifications_expiry_date_idx" ON "employee_certifications"("expiry_date");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "training_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
