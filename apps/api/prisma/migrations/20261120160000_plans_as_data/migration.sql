-- CreateTable plans
CREATE TABLE IF NOT EXISTS "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex plans_code_key
CREATE UNIQUE INDEX IF NOT EXISTS "plans_code_key" ON "plans"("code");

-- CreateTable plan_prices
CREATE TABLE IF NOT EXISTS "plan_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "per_seat_amount" DECIMAL(14,2),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex plan_prices indexes
CREATE INDEX IF NOT EXISTS "plan_prices_plan_id_idx" ON "plan_prices"("plan_id");
CREATE INDEX IF NOT EXISTS "plan_prices_currency_billing_cycle_idx" ON "plan_prices"("currency", "billing_cycle");
CREATE INDEX IF NOT EXISTS "plan_prices_effective_from_effective_to_idx" ON "plan_prices"("effective_from", "effective_to");

-- AddForeignKey plan_prices
ALTER TABLE "plan_prices" DROP CONSTRAINT IF EXISTS "plan_prices_plan_id_fkey";
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable plan_features
CREATE TABLE IF NOT EXISTS "plan_features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex plan_features indexes
CREATE UNIQUE INDEX IF NOT EXISTS "plan_features_plan_id_feature_key_key" ON "plan_features"("plan_id", "feature_key");
CREATE INDEX IF NOT EXISTS "plan_features_plan_id_idx" ON "plan_features"("plan_id");
CREATE INDEX IF NOT EXISTS "plan_features_feature_key_idx" ON "plan_features"("feature_key");

-- AddForeignKey plan_features
ALTER TABLE "plan_features" DROP CONSTRAINT IF EXISTS "plan_features_plan_id_fkey";
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable plan_limits
CREATE TABLE IF NOT EXISTS "plan_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "limit_key" TEXT NOT NULL,
    "value" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex plan_limits indexes
CREATE UNIQUE INDEX IF NOT EXISTS "plan_limits_plan_id_limit_key_key" ON "plan_limits"("plan_id", "limit_key");
CREATE INDEX IF NOT EXISTS "plan_limits_plan_id_idx" ON "plan_limits"("plan_id");
CREATE INDEX IF NOT EXISTS "plan_limits_limit_key_idx" ON "plan_limits"("limit_key");

-- AddForeignKey plan_limits
ALTER TABLE "plan_limits" DROP CONSTRAINT IF EXISTS "plan_limits_plan_id_fkey";
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable tenant_feature_overrides
CREATE TABLE IF NOT EXISTS "tenant_feature_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex tenant_feature_overrides indexes
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_feature_overrides_tenant_id_feature_key_key" ON "tenant_feature_overrides"("tenant_id", "feature_key");
CREATE INDEX IF NOT EXISTS "tenant_feature_overrides_tenant_id_idx" ON "tenant_feature_overrides"("tenant_id");

-- AddForeignKey tenant_feature_overrides
ALTER TABLE "tenant_feature_overrides" DROP CONSTRAINT IF EXISTS "tenant_feature_overrides_tenant_id_fkey";
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable tenant_limit_overrides
CREATE TABLE IF NOT EXISTS "tenant_limit_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "limit_key" TEXT NOT NULL,
    "value" INTEGER,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_limit_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex tenant_limit_overrides indexes
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_limit_overrides_tenant_id_limit_key_key" ON "tenant_limit_overrides"("tenant_id", "limit_key");
CREATE INDEX IF NOT EXISTS "tenant_limit_overrides_tenant_id_idx" ON "tenant_limit_overrides"("tenant_id");

-- AddForeignKey tenant_limit_overrides
ALTER TABLE "tenant_limit_overrides" DROP CONSTRAINT IF EXISTS "tenant_limit_overrides_tenant_id_fkey";
ALTER TABLE "tenant_limit_overrides" ADD CONSTRAINT "tenant_limit_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
