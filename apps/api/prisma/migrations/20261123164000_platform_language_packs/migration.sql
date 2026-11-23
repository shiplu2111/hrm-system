-- CreateTable
CREATE TABLE "platform_language_packs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "native_name" VARCHAR(100) NOT NULL,
    "direction" VARCHAR(3) NOT NULL DEFAULT 'ltr',
    "is_available_to_tenants" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "total_keys" INTEGER NOT NULL DEFAULT 0,
    "translated_keys" INTEGER NOT NULL DEFAULT 0,
    "completeness_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "last_imported_at" TIMESTAMPTZ(6),
    "last_exported_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_language_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_language_packs_code_key" ON "platform_language_packs"("code");

-- CreateIndex
CREATE INDEX "platform_language_packs_is_available_to_tenants_idx" ON "platform_language_packs"("is_available_to_tenants");

-- CreateIndex
CREATE INDEX "platform_language_packs_code_idx" ON "platform_language_packs"("code");
