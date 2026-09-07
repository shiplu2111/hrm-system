-- 360° feedback, overall rating, promotion recommendation (MODULES.md §25)
-- Lifecycle performance_review event type (Phase 1 Stage 4.2)

ALTER TYPE "lifecycle_event_type" ADD VALUE 'performance_review';

CREATE TYPE "performance_360_relationship" AS ENUM ('peer', 'direct_report', 'cross_functional');
CREATE TYPE "performance_360_feedback_status" AS ENUM ('pending', 'submitted');
CREATE TYPE "promotion_recommendation_status" AS ENUM ('none', 'draft', 'submitted', 'approved', 'rejected', 'executed');

ALTER TABLE "employee_performance_reviews"
  ADD COLUMN "overall_rating" DECIMAL(3, 2),
  ADD COLUMN "overall_rating_label" TEXT,
  ADD COLUMN "performance_360_summary" JSONB,
  ADD COLUMN "promotion_recommended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recommended_designation_id" UUID,
  ADD COLUMN "promotion_recommendation_note" TEXT,
  ADD COLUMN "promotion_recommendation_status" "promotion_recommendation_status" NOT NULL DEFAULT 'none',
  ADD COLUMN "performance_lifecycle_event_id" UUID,
  ADD COLUMN "promotion_lifecycle_event_id" UUID;

CREATE UNIQUE INDEX "employee_performance_reviews_performance_lifecycle_event_id_key"
  ON "employee_performance_reviews"("performance_lifecycle_event_id");
CREATE UNIQUE INDEX "employee_performance_reviews_promotion_lifecycle_event_id_key"
  ON "employee_performance_reviews"("promotion_lifecycle_event_id");

ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_recommended_designation_id_fkey"
    FOREIGN KEY ("recommended_designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_performance_lifecycle_event_id_fkey"
    FOREIGN KEY ("performance_lifecycle_event_id") REFERENCES "employee_lifecycle_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_performance_reviews"
  ADD CONSTRAINT "employee_performance_reviews_promotion_lifecycle_event_id_fkey"
    FOREIGN KEY ("promotion_lifecycle_event_id") REFERENCES "employee_lifecycle_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "performance_360_feedback" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "review_id" UUID NOT NULL,
  "reviewer_employee_id" UUID NOT NULL,
  "relationship" "performance_360_relationship" NOT NULL,
  "status" "performance_360_feedback_status" NOT NULL DEFAULT 'pending',
  "competency_ratings" JSONB NOT NULL DEFAULT '[]',
  "comment" TEXT,
  "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
  "submitted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "performance_360_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_360_feedback_review_id_reviewer_employee_id_key"
  ON "performance_360_feedback"("review_id", "reviewer_employee_id");
CREATE INDEX "performance_360_feedback_tenant_id_idx" ON "performance_360_feedback"("tenant_id");
CREATE INDEX "performance_360_feedback_company_id_idx" ON "performance_360_feedback"("company_id");
CREATE INDEX "performance_360_feedback_review_id_idx" ON "performance_360_feedback"("review_id");
CREATE INDEX "performance_360_feedback_reviewer_employee_id_idx" ON "performance_360_feedback"("reviewer_employee_id");

ALTER TABLE "performance_360_feedback"
  ADD CONSTRAINT "performance_360_feedback_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_360_feedback"
  ADD CONSTRAINT "performance_360_feedback_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_360_feedback"
  ADD CONSTRAINT "performance_360_feedback_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "employee_performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_360_feedback"
  ADD CONSTRAINT "performance_360_feedback_reviewer_employee_id_fkey"
    FOREIGN KEY ("reviewer_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
