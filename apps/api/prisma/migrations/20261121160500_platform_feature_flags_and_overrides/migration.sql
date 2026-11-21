-- CreateTable platform_feature_flags
CREATE TABLE IF NOT EXISTS "platform_feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "default_state" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percentage" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_feature_flags_key_key" ON "platform_feature_flags"("key");
CREATE INDEX IF NOT EXISTS "platform_feature_flags_key_idx" ON "platform_feature_flags"("key");
CREATE INDEX IF NOT EXISTS "platform_feature_flags_default_state_idx" ON "platform_feature_flags"("default_state");

-- AlterTable tenant_feature_overrides
ALTER TABLE "tenant_feature_overrides" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_feature_overrides_expires_at_idx" ON "tenant_feature_overrides"("expires_at");
CREATE INDEX IF NOT EXISTS "tenant_feature_overrides_feature_key_idx" ON "tenant_feature_overrides"("feature_key");
