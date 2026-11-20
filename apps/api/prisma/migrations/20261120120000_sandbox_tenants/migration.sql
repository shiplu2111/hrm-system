-- AlterTable tenants
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "is_sandbox" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sandbox_template" TEXT,
  ADD COLUMN IF NOT EXISTS "sandbox_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_reset_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "demo_lead_name" TEXT,
  ADD COLUMN IF NOT EXISTS "demo_lead_email" TEXT;
