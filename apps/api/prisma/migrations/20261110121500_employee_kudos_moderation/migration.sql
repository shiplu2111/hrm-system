-- Employee recognition / kudos moderation fields (MODULES.md §29, Stage 28.2)

CREATE TYPE "employee_kudos_moderation_status" AS ENUM ('active', 'removed');

ALTER TABLE "employee_kudos"
  ADD COLUMN "moderation_status" "employee_kudos_moderation_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "removed_at" TIMESTAMP(3),
  ADD COLUMN "removed_by_user_id" UUID,
  ADD COLUMN "removal_reason" TEXT;

CREATE INDEX "employee_kudos_company_id_moderation_status_created_at_idx"
  ON "employee_kudos"("company_id", "moderation_status", "created_at");

CREATE INDEX "employee_kudos_removed_by_user_id_idx"
  ON "employee_kudos"("removed_by_user_id");

ALTER TABLE "employee_kudos"
  ADD CONSTRAINT "employee_kudos_removed_by_user_id_fkey"
  FOREIGN KEY ("removed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

