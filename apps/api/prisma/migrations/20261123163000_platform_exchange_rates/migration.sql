-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "platform_rate_source" AS ENUM ('manual', 'provider', 'manual_override');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_exchange_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "base_currency" VARCHAR(3) NOT NULL,
    "quote_currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "inverse_rate" DECIMAL(18,8),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "source" "platform_rate_source" NOT NULL DEFAULT 'manual',
    "provider_name" VARCHAR(64),
    "override_reason" TEXT,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_exchange_rates_base_currency_quote_currency_effect_idx" ON "platform_exchange_rates"("base_currency", "quote_currency", "effective_from");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_exchange_rates_source_idx" ON "platform_exchange_rates"("source");
