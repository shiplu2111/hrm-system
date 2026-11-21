-- CreateEnum
CREATE TYPE "state_province_status" AS ENUM ('active', 'retired');

-- AlterTable
ALTER TABLE "states_provinces" ADD COLUMN "status" "state_province_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "state_province_id" UUID;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN "state_province_id" UUID;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_state_province_id_fkey" FOREIGN KEY ("state_province_id") REFERENCES "states_provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_state_province_id_fkey" FOREIGN KEY ("state_province_id") REFERENCES "states_provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
