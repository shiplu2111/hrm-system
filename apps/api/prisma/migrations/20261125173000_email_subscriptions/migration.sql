-- CreateTable
CREATE TABLE IF NOT EXISTS "email_subscriptions" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'blog',
    "consent_granted" BOOLEAN NOT NULL DEFAULT true,
    "consent_text" TEXT NOT NULL,
    "consent_version" TEXT NOT NULL DEFAULT '2026-11',
    "consent_at" TIMESTAMPTZ(6) NOT NULL,
    "source_page" TEXT,
    "ip_address" TEXT,
    "unsubscribed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "email_subscriptions_email_channel_key" ON "email_subscriptions"("email", "channel");
CREATE INDEX IF NOT EXISTS "email_subscriptions_channel_idx" ON "email_subscriptions"("channel");
CREATE INDEX IF NOT EXISTS "email_subscriptions_created_at_idx" ON "email_subscriptions"("created_at");
