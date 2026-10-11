-- Webhook delivery retry tracking (API_GUIDELINES.md §9)

ALTER TABLE "webhook_deliveries" ADD COLUMN "last_attempt_at" TIMESTAMP(3);
ALTER TABLE "webhook_deliveries" ADD COLUMN "next_attempt_at" TIMESTAMP(3);

ALTER TABLE "tenant_webhooks" ADD COLUMN "secret_rotated_at" TIMESTAMP(3);
