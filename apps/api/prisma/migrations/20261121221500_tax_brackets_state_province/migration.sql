-- AlterTable
ALTER TABLE "tax_brackets" ADD COLUMN IF NOT EXISTS "state_province_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tax_brackets_state_province_id_idx" ON "tax_brackets"("state_province_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tax_brackets_country_id_state_province_id_tax_year_effective_f_idx" ON "tax_brackets"("country_id", "state_province_id", "tax_year", "effective_from");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_brackets_state_province_id_fkey'
  ) THEN
    ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_state_province_id_fkey" FOREIGN KEY ("state_province_id") REFERENCES "states_provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
