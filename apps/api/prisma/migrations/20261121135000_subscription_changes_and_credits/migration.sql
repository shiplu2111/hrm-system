-- AlterTable subscriptions
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "discount_percent" DECIMAL(5,2);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "discount_reason" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "credit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pause_reason" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;

-- CreateTable subscription_changes
CREATE TABLE IF NOT EXISTS "subscription_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "from_plan_id" UUID,
    "to_plan_id" UUID,
    "from_status" TEXT,
    "to_status" TEXT,
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "reason" TEXT,
    "metadata" JSONB,
    "actor_id" UUID,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_changes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscription_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscription_changes_subscription_id_idx" ON "subscription_changes"("subscription_id");
CREATE INDEX IF NOT EXISTS "subscription_changes_tenant_id_idx" ON "subscription_changes"("tenant_id");
CREATE INDEX IF NOT EXISTS "subscription_changes_action_idx" ON "subscription_changes"("action");
CREATE INDEX IF NOT EXISTS "subscription_changes_created_at_idx" ON "subscription_changes"("created_at");
