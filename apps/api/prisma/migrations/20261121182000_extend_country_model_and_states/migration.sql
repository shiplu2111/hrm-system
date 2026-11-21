-- CreateEnum
CREATE TYPE "country_status" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "rule_version_status" AS ENUM ('draft', 'published', 'archived');

-- AlterEnum
ALTER TYPE "country_rule_type" ADD VALUE 'employment_rules';

-- AlterTable
ALTER TABLE "countries" 
  ADD COLUMN "default_financial_year_start" VARCHAR(5) NOT NULL DEFAULT '01-01',
  ADD COLUMN "default_pay_frequency" VARCHAR(32) NOT NULL DEFAULT 'monthly',
  ADD COLUMN "status" "country_status" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "country_rules" 
  ADD COLUMN "status" "rule_version_status" NOT NULL DEFAULT 'published';

-- AlterTable
ALTER TABLE "tax_brackets" 
  ADD COLUMN "status" "rule_version_status" NOT NULL DEFAULT 'published';

-- CreateTable
CREATE TABLE "states_provinces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_provinces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "states_provinces_country_id_code_key" ON "states_provinces"("country_id", "code");
CREATE INDEX "states_provinces_country_id_idx" ON "states_provinces"("country_id");

-- AddForeignKey
ALTER TABLE "states_provinces" ADD CONSTRAINT "states_provinces_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
