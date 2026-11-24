-- CreateTable
CREATE TABLE "usage_daily" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "active_employees" INTEGER NOT NULL DEFAULT 0,
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "api_calls" INTEGER NOT NULL DEFAULT 0,
    "notifications_total" INTEGER NOT NULL DEFAULT 0,
    "notifications_email" INTEGER NOT NULL DEFAULT 0,
    "notifications_sms" INTEGER NOT NULL DEFAULT 0,
    "notifications_push" INTEGER NOT NULL DEFAULT 0,
    "notifications_in_app" INTEGER NOT NULL DEFAULT 0,
    "attendance_events_synced" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_sync_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'attendance',
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_daily_tenant_id_idx" ON "usage_daily"("tenant_id");

-- CreateIndex
CREATE INDEX "usage_daily_date_idx" ON "usage_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "usage_daily_tenant_id_date_key" ON "usage_daily"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "mobile_sync_logs_tenant_id_idx" ON "mobile_sync_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "mobile_sync_logs_created_at_idx" ON "mobile_sync_logs"("created_at");

-- AddForeignKey
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sync_logs" ADD CONSTRAINT "mobile_sync_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
