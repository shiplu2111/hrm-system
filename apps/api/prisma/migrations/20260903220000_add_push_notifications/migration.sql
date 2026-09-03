-- Push notifications (NOTIFICATION_LOGIC.md §2, §6)

ALTER TYPE "notification_channel_type" ADD VALUE 'push';

CREATE TYPE "push_platform" AS ENUM ('ios', 'android');

ALTER TABLE "notification_deliveries" ADD COLUMN "recipient_push_token" TEXT;

CREATE TABLE "push_device_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "push_platform" NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_device_tokens_user_id_device_id_key" ON "push_device_tokens"("user_id", "device_id");
CREATE INDEX "push_device_tokens_tenant_id_idx" ON "push_device_tokens"("tenant_id");
CREATE INDEX "push_device_tokens_user_id_idx" ON "push_device_tokens"("user_id");

ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
