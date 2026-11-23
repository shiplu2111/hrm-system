-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "platform_template_category" AS ENUM ('document_types', 'leave_policies', 'notification_templates', 'default_roles', 'onboarding_checklists');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "provisioned_template_versions" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_default_templates" (
    "id" UUID NOT NULL,
    "country_id" UUID,
    "category" "platform_template_category" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "rule_version_status" NOT NULL DEFAULT 'published',
    "payload" JSONB NOT NULL,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" DATE,
    "change_summary" TEXT,
    "source_reference" TEXT,
    "created_by" TEXT NOT NULL DEFAULT 'system',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_default_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_default_templates_country_id_idx" ON "platform_default_templates"("country_id");
CREATE INDEX IF NOT EXISTS "platform_default_templates_category_status_idx" ON "platform_default_templates"("category", "status");
CREATE INDEX IF NOT EXISTS "platform_default_templates_country_id_category_status_idx" ON "platform_default_templates"("country_id", "category", "status");
CREATE INDEX IF NOT EXISTS "platform_default_templates_category_effective_from_idx" ON "platform_default_templates"("category", "effective_from");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "platform_default_templates" ADD CONSTRAINT "platform_default_templates_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
