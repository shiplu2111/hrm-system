-- CreateEnum
CREATE TYPE "role_data_scope" AS ENUM ('all', 'team');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN "data_scope" "role_data_scope" NOT NULL DEFAULT 'all';
