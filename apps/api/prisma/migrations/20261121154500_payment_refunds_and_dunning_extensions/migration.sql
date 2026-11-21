-- AlterEnum
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'partially_refunded';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount_refunded" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "refund_reason" TEXT,
ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_retry_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "refunded_by" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'succeeded',
    "provider_refund_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_refunds_tenant_id_idx" ON "payment_refunds"("tenant_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_payment_id_idx" ON "payment_refunds"("payment_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_tenant_id_fkey'
    ) THEN
        ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_payment_id_fkey'
    ) THEN
        ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
