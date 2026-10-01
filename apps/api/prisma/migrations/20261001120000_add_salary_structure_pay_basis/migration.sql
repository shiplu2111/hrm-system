-- CreateEnum
CREATE TYPE "salary_pay_basis" AS ENUM ('monthly', 'daily', 'hourly');

-- AlterTable
ALTER TABLE "salary_structures" ADD COLUMN "pay_basis" "salary_pay_basis" NOT NULL DEFAULT 'monthly';
