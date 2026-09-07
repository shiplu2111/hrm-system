-- Multi-timezone + locale formatting (MODULES.md §46)

ALTER TABLE "countries" ADD COLUMN "number_format" TEXT NOT NULL DEFAULT '1,234.56';

ALTER TABLE "companies" ADD COLUMN "timezone" TEXT;

ALTER TABLE "locations" ADD COLUMN "timezone" TEXT;
